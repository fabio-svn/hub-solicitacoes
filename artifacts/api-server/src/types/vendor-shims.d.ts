declare module 'opentype.js' {
  namespace opentype {
    class Font { constructor(...a: any[]); [k: string]: any; }
    class Path { constructor(...a: any[]); [k: string]: any; }
    class Glyph { constructor(...a: any[]); [k: string]: any; }
    function parse(buf: any): Font;
    function load(url: string, cb?: any): any;
    function loadSync(url: string): Font;
  }
  export = opentype;
}
declare module 'svg-to-pdfkit';
declare module 'fontkit';
