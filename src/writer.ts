import { DepGraph } from "dependency-graph";
import { EpubContent, EpubDocument } from "./document";
import archiver from "archiver";
import { WriteStream } from "fs";
import path from "path";
import { create, fragment } from "xmlbuilder2";
import { toXmlDate } from "./time";
import { XMLBuilder } from "xmlbuilder2/lib/interfaces";
import { styles } from "./styles";

// [Container file is required to be located here](https://www.w3.org/TR/epub-33/#sec-container-metainf-container.xml)
const OCF_CONTAINER_PATH = "META-INF/container.xml";

function idFromFilename(filename: string): string {
  return filename.replace(/(\.|\/|_|-)+/g, "-").replace(/-+/g, "-");
}

export interface EpubResource {
  /** The filename of this resource, relative to the ePub root. */
  filename: string;

  /** Replaces the filename-derived automatic ID, if provided. */
  id?: string;

  mimetype: string;

  /** Used for the manifest's `properties` attribute, if provided. */
  properties?: string;

  contents: string;

  /** Whether this resource should be included in the spine (which specifies the order of the content). */
  includeInSpine?: boolean;
}

interface ChapterInfo {
  /** The zero-based index of the chapter in the ePub. */
  index: number;

  content: EpubContent;
}

/** The primary write logic lives here. */
export class EpubWriter {
  protected document: EpubDocument;

  protected resources = new DepGraph<EpubResource>();

  constructor(document: EpubDocument) {
    this.document = document;
  }

  /** The path prefix for metadata stored in this ePub file, relative to the ePub root. */
  protected get metadataRootPath(): string {
    return "epub";
  }

  /** The path prefix for all content stored in this ePub file, relative to the ePub root. */
  protected get contentRootPath(): string {
    return "epub/content";
  }

  /** The path to the ePub [Package Document](https://www.w3.org/TR/epub-33/#sec-package-doc), relative to the ePub root. */
  protected get packageDocumentPath(): string {
    return path.join(this.metadataRootPath, "document.opf");
  }

  /** The path to the navigation (table of contents) XHTML file, relative to the ePub root. */
  protected get navigationPath(): string {
    return path.join(this.metadataRootPath, "nav.xhtml");
  }

  protected get modifiedDateString(): string {
    return toXmlDate(new Date());
  }

  /** Creates the OCF container XML file (stored at `META-INF/container.xml`) */
  protected async generateOcfContainerXml(): Promise<string> {
    const doc = create({
      version: "1.0",
    })
      .ele("container", {
        version: "1.0",
        xmlns: "urn:oasis:names:tc:opendocument:xmlns:container",
      })
      .ele("rootfiles")
      .ele("rootfile", {
        "full-path": this.packageDocumentPath,
        "media-type": "application/oebps-package+xml",
      });

    return doc.doc().end({ prettyPrint: true });
  }

  /** Creates the ePub Package Document XML file. */
  protected async generatePackageDocumentXml(): Promise<string> {
    const IDREF = {
      // The ID of the `dc:identifier` tag. Yes, this is confusing.
      unique_identifier: "identifier",
      title: "title",
      cover: "cover",
    };

    const metadata = fragment().ele("metadata", {
      "xmlns:dc": "http://purl.org/dc/elements/1.1/",
    });

    metadata
      .ele("meta", { property: "dcterms:modified" })
      .txt(this.modifiedDateString);
    metadata
      .ele("dc:identifier", { id: IDREF.unique_identifier })
      .txt(this.document.identifier);
    metadata.ele("dc:title", { id: IDREF.title }).txt(this.document.title);
    metadata.ele("dc:creator").txt(this.document.author);
    metadata.ele("dc:language").txt(this.document.language);

    // All resources included in the file.
    const manifest = fragment().ele("manifest");
    // Resources in the file that are part of the logical content of the ePub.
    const spine = fragment().ele("spine");

    const packageDocumentDirectory = path.dirname(this.packageDocumentPath);

    this.resources.dependenciesOf(this.packageDocumentPath).forEach((name) => {
      const resource = this.resources.getNodeData(name);
      const id = resource.id ?? idFromFilename(resource.filename);
      const relativePath = path.relative(
        packageDocumentDirectory,
        resource.filename,
      );

      manifest.ele("item", {
        id,
        href: relativePath,
        "media-type": resource.mimetype,
        properties: resource.properties,
      });

      if (resource.includeInSpine) {
        spine.ele("itemref", {
          idref: id,
        });
      }
    });

    const doc = create({
      version: "1.0",
    })
      .ele("package", {
        version: "3.0",
        xmlns: "http://www.idpf.org/2007/opf",
        "unique-identifier": IDREF.unique_identifier,
      })
      .import(metadata)
      .import(manifest)
      .import(spine);

    return doc.doc().end({ prettyPrint: true });
  }

  protected hasResource(filename: string): boolean {
    return this.resources.hasNode(filename);
  }

  // Upserts the provided resource.
  protected addResource(
    resource: EpubResource,
    requiredBy: string,
  ): EpubResource {
    const id = resource.filename;
    // TODO: deep equals compare.
    /*
    if (this.hasResource(resource.filename)) {
      throw new Error(
        `cannot add duplicate resource named '${resource.filename}' to epub`,
      );
    }
    */

    if (!this.hasResource(resource.filename)) {
      this.resources.addNode(id, resource);
    } else {
      const existingResource = this.resources.getNodeData(id);

      if (existingResource.mimetype !== resource.mimetype) {
        throw new Error(
          `cannot add duplicate resource named '${resource.filename}' with different mimetype to epub`,
        );
      }

      // Merge all other properties.
      this.resources.setNodeData(id, {
        ...existingResource,
        ...resource,
      });
    }

    this.resources.addDependency(requiredBy, id);

    return resource;
  }

  protected addCssResource(
    filename: string,
    contents: string,
    requiredBy: string,
  ) {
    return this.addResource(
      {
        filename,
        mimetype: "text/css",
        contents,
      },
      requiredBy,
    );
  }

  protected addHtmlResource(
    filename: string,
    contents: XMLBuilder,
    resource: Partial<EpubResource> & { styles?: Record<string, string> } = {},
  ) {
    if (!this.hasResource(filename)) {
      // Add a placeholder HTML resource to ensure the CSS resources have something to reference.
      this.addResource(
        {
          filename,
          mimetype: "application/xhtml+xml",
          contents: "",
          ...resource,
        },
        this.packageDocumentPath,
      );
    }

    const { styles } = resource;

    // Add CSS link tags to the head of the HTML document
    const head = contents.find(
      (node) => node.node.nodeName === "head",
      false,
      true,
    );
    if (head && styles) {
      const linkTags = fragment();

      for (const [name, css] of Object.entries(styles)) {
        const cssFilename = path.join(this.metadataRootPath, `${name}.css`);
        const relativePath = path.relative(path.dirname(filename), cssFilename);
        this.addCssResource(cssFilename, css, filename);
        linkTags.ele("link", { rel: "stylesheet", href: relativePath });
      }

      head.import(linkTags);
    }

    return this.addResource(
      {
        filename,
        mimetype: "application/xhtml+xml",
        contents: contents.end({ prettyPrint: true }),
        ...resource,
      },
      this.packageDocumentPath,
    );
  }

  /** Returns the zero-based index of the chapter in the ePub. */
  protected getChapterIndex(info: ChapterInfo): number {
    return info.index;
  }

  protected getChapterTitle(info: ChapterInfo): string {
    // TODO: translate this to the language of the ePub.
    return info.content.title ?? `Chapter ${this.getChapterIndex(info) + 1}`;
  }

  /** A unique ID for the chapter. */
  protected getChapterId(info: ChapterInfo): string {
    return `chapter-${this.getChapterIndex(info) + 1}`;
  }

  /** The path to the chapter's XHTML file, relative to the ePub root. */
  protected getChapterPath(info: ChapterInfo): string {
    return path.join(
      this.contentRootPath,
      `chapter-${this.getChapterIndex(info) + 1}.xhtml`,
    );
  }

  // Adds the navigation object to the ePub.
  protected async addNavigation() {
    const IDREF = {
      nav: "toc",
      navOl: "tocList",
    };

    const navigationDirectory = path.dirname(this.navigationPath);

    const nav = fragment().ele("nav", { "epub:type": "toc", id: IDREF.nav });

    // TODO: translate this to the language of the ePub.
    //nav.ele("h2", { class: "toc__title" }).txt("Table of Contents");

    const contentsList = nav.ele("ol", { id: IDREF.navOl });

    this.document.chapters.forEach((content, index) => {
      const info: ChapterInfo = {
        index,
        content,
      };

      contentsList
        .ele("li", { id: this.getChapterId(info) })
        .ele("a", {
          href: path.relative(navigationDirectory, this.getChapterPath(info)),
        })
        .txt(this.getChapterTitle(info));
    });

    const doc = create()
      .ele("html", {
        xmlns: "http://www.w3.org/1999/xhtml",
        "xmlns:epub": "http://www.idpf.org/2007/ops",
        "xml:lang": this.document.language,
        lang: this.document.language,
      })
      .dec({
        version: "1.0",
        encoding: "utf-8",
      })
      .dtd()
      .ele("head")
      .ele("title")
      .txt(this.document.title)
      .up()
      .up()
      .ele("body")
      .import(nav);

    this.addHtmlResource(this.navigationPath, doc.doc(), {
      properties: "nav",
      includeInSpine: true,
      styles: {
        global: styles.global,
        navigation: styles.navigation,
      },
    });
  }

  protected addChapter(info: ChapterInfo) {
    const chapterPath = this.getChapterPath(info);

    const content = fragment(`<main>${info.content.content}</main>`);
    const head = fragment().ele("head");

    head.ele("title").txt(this.getChapterTitle(info));

    const doc = create()
      .ele("html", {
        xmlns: "http://www.w3.org/1999/xhtml",
        "xmlns:epub": "http://www.idpf.org/2007/ops",
        "xml:lang": this.document.language,
        lang: this.document.language,
      })
      .import(head);

    const body = doc.ele("body");
    body
      .ele("header", { class: "chapter" })
      .ele("h1", { class: "chapter__title" })
      .txt(this.getChapterTitle(info));

    body.import(content);

    const chapter = this.addHtmlResource(chapterPath, doc.doc(), {
      id: this.getChapterId(info),
      includeInSpine: true,

      styles: {
        global: styles.global,
        content: styles.content,
      },
    });
  }

  protected addContent() {
    this.document.chapters.forEach((content, index) => {
      this.addChapter({ index, content });
    });
  }

  protected async addCover() {
    const doc = create().ele("html", {
      xmlns: "http://www.w3.org/1999/xhtml",
      "xmlns:epub": "http://www.idpf.org/2007/ops",
      "xml:lang": this.document.language,
      lang: this.document.language,
    });

    const coverPath = path.join(this.metadataRootPath, "cover.xhtml");

    const head = doc.ele("head");
    head.ele("title").txt(this.document.title);

    doc
      .ele("body")
      .ele("header", { class: "cover" })
      .ele("h1", { class: "cover__title" })
      .txt(this.document.title)
      .up()
      .ele("h2", { class: "cover__author" })
      .txt(this.document.author);

    this.addHtmlResource(coverPath, doc.doc(), {
      includeInSpine: true,
      styles: {
        global: styles.global,
        cover: styles.cover,
      },
    });
  }

  /** Collects and adds all resource files we need in this ePub. */
  protected async collectResources() {
    this.resources.addNode(this.packageDocumentPath, undefined);

    this.addCover();

    this.addNavigation();

    this.addContent();
  }

  /** Writes the epub to the provided output stream. */
  async write(output: WriteStream) {
    this.resources = new DepGraph<EpubResource>();

    const archive = archiver("zip", {
      zlib: { level: 9 },
    });

    archive.pipe(output);

    await this.collectResources();

    // 1. Add the "mimetype" file - this cannot be compressed and must be first in the zip file.
    archive.append("application/epub+zip", { name: "mimetype", store: true });

    // 2. Create the [OCF container file](https://www.w3.org/TR/epub-33/#sec-container-metainf-container.xml).
    archive.append(await this.generateOcfContainerXml(), {
      name: OCF_CONTAINER_PATH,
    });

    // 3. Create the [Package Document file](https://www.w3.org/TR/epub-33/#sec-package-doc)
    archive.append(await this.generatePackageDocumentXml(), {
      name: this.packageDocumentPath,
    });

    // 4. Create and add all ePub content.
    const resources = this.resources
      .dependenciesOf(this.packageDocumentPath)
      .map((name) => this.resources.getNodeData(name));

    for (const resource of resources) {
      archive.append(resource.contents, {
        name: resource.filename,
      });
    }

    await archive.finalize();
  }
}
