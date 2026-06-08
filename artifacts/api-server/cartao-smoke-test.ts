// cartao-smoke-test.ts
// Teste isolado do gerador de cartão — NÃO toca em rota, banco nem R2.
// Objetivo: provar que opentype + Roobert + svg-to-pdfkit funcionam no seu ambiente.
//
// Como rodar (na raiz do projeto, com os assets já em assets/cartao/):
//   npx tsx cartao-smoke-test.ts
// Saída esperada: cria ./cartao-teste.pdf (2 páginas, 9,4x5,4cm com sangria).

import fs from "fs";
import { gerarVersoSvg, gerarPdf } from "./src/cartao/gerar-cartao"; // a partir da raiz de artifacts/api-server

async function main() {
  const dados = {
    nome: "Fábio Santos",
    telefone: "(44) 99999-9999",
    email: "fabio.santos@svninvestimentos.com.br",
  };

  // 1) SVG do verso (é o que vai no preview live do form)
  const svg = gerarVersoSvg(dados);
  fs.writeFileSync("cartao-verso.svg", svg);
  const nPaths = (svg.match(/<path/g) || []).length;
  console.log(`✓ Verso gerado: ${nPaths} paths (esperado 3) | tem <text>? ${/<text/.test(svg) ? "SIM (erro)" : "não (ok)"}`);

  // 2) PDF final com sangria
  const pdf = await gerarPdf(dados);
  fs.writeFileSync("cartao-teste.pdf", pdf);
  console.log(`✓ PDF gerado: ${pdf.length} bytes -> ./cartao-teste.pdf`);
  console.log("Abra o PDF: deve ter 2 páginas (frente logo + verso), texto na Roobert, centralizado.");
}

main().catch((e) => {
  console.error("✗ Falhou:", e.message);
  process.exit(1);
});
