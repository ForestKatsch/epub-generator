/** A single piece of content within the document. This normally corresponds to a single chapter. */
export interface EpubContent {
  /** If provided, will be used as the title of this content piece. */
  title?: string;

  /** HTML content of this section. */
  content: string;
}

export interface EpubDocument {
  /** A globally unique [identifier for this document](https://idpf.org/epub/30/spec/epub30-publications.html#sec-opf-dcidentifier). An ISBN is commonly used as the identifier. */
  identifier: string;

  /** A language tag that conforms to [RFC 5646](https://datatracker.ietf.org/doc/html/rfc5646). This can be something like "en" or "en-US". */
  language: string;

  /** The title of this document. */
  title: string;

  /** The author of this document. */
  author: string;

  chapters: EpubContent[];
}
