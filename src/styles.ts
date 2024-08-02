export const styles = {
  /** Complete CSS reset for the entire document. Must be suitable for epub readers and their quirks. */
  global: `
    * {
      margin: 0;
      padding: 0;
      font-size: 100%;
      font-weight: normal;
      font-style: normal;
      font-family: inherit;
      color: inherit;
      background-color: transparent;
      border: 0;
      outline: 0;
      box-sizing: border-box;
    }

    html, body, div, span, applet, object, iframe,
    h1, h2, h3, h4, h5, h6, p, blockquote, pre,
    a, abbr, acronym, address, big, cite, code,
    del, dfn, em, img, ins, kbd, q, s, samp,
    small, strike, strong, sub, sup, tt, var,
    b, u, i, center,
    dl, dt, dd, ol, ul, li,
    fieldset, form, label, legend,
    table, caption, tbody, tfoot, thead, tr, th, td,
    article, aside, canvas, details, embed,
    figure, figcaption, footer, header, hgroup,
    menu, nav, output, ruby, section, summary,
    time, mark, audio, video {
      margin: 0;
      padding: 0;
      border: 0;
      font-size: 100%;
      font: inherit;
      vertical-align: baseline;
    }

    /* HTML5 display-role reset for older browsers */
    article, aside, details, figcaption, figure,
    footer, header, hgroup, menu, nav, section {
      display: block;
    }

    body {
      line-height: 1;
    }

    ol, ul {
      list-style: none;
    }

    blockquote, q {
      quotes: none;
    }

    blockquote:before, blockquote:after,
    q:before, q:after {
      content: '';
      content: none;
    }

    table {
      border-collapse: collapse;
      border-spacing: 0;
    }
  `,
  /** CSS for the cover page. */
  cover: `
    body {
      font-family: "serif";
      text-align: center;
      display: flex;
      flex-direction: column;
      align-items: stretch;
      line-height: 1.5;
    }

    .cover {
      margin: 4rem 0rem;
    }

    .cover > * + * {
      margin-top: 1rem;
    }

    .cover__title {
      font-size: 2em;
      font-weight: bold;
    }

    .cover__author {
      font-size: 1.5em;
      font-weight: bold;
    }
  `,
  navigation: `
    body {
      font-family: "serif";
      line-height: 1.5;
    }

    nav {
      margin-top: 4rem;
      margin-bottom: 1rem;
    }

    ol.toc {
      list-style: none;
    }

    a {
      color: #38f;
      text-decoration: none;
    }
  `,
  content: `
    body {
      font-family: "serif";
      line-height: 1.5;
    }

    p+ p {
      text-indent: 2em;
    }

    .chapter {
      margin-top: 4rem;
      margin-bottom: 1rem;
    }

    .chapter__title {
      font-size: 2em;
      font-weight: bold;
    }
  `,
};
