import { EpubDocument } from "./document";
import { WriteStream, createWriteStream } from "fs";
import { EpubWriter } from "./writer";

/** Write the provided `EpubDocument` to a write stream. */
export async function writeEpubStream(
  stream: WriteStream,
  document: EpubDocument,
) {
  const writer = new EpubWriter(document);
  await writer.write(stream);
}

/** Write the provided `EpubDocument` to a file. */
export async function writeEpub(filename: string, document: EpubDocument) {
  const output = createWriteStream(filename);
  await writeEpubStream(output, document);
}
