import { EpubDocument } from "./document";
import { writeEpub } from "./write";
import { temporaryFile } from "tempy";

const TEST_DOCUMENT: EpubDocument = {
  identifier: "__test-document",
  language: "en-US",
  title: "Test Document",
  chapters: [
    {
      content: "Hello, world",
    },
  ],
};

describe("EpubWriter", () => {
  it("should not compress the metadata file", async () => {
    const filename = temporaryFile();
    await writeEpub(filename, TEST_DOCUMENT);
  });
});
