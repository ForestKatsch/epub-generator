import { EpubDocument } from "./document";
import { writeEpub } from "./write";

const document: EpubDocument = {
  identifier: "url:https://forestkatsch.com/epub-generator/fire-and-ice.epub",
  language: "en-US",
  title: "Fire and Ice",
  author: "Robert Frost",
  chapters: [
    {
      content: `Some say the world will end in fire;<br />
Some say in ice.<br />
From what I've tasted of desire<br />
I hold with those who favor fire.<br />
But if it had to perish twice,<br />
I think I know enough of hate<br />
To know that for destruction ice<br />
Is also great<br />
And would suffice.<br />`,
    },
  ],
};

async function main() {
  await writeEpub("/tmp/test.epub", document);
}

main();
