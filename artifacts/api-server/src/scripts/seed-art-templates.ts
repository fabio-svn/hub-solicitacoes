import { db } from "@workspace/db";
import { artTemplatesTable } from "@workspace/db";
import { sql } from "drizzle-orm";
import { ArtTemplate } from "../types/art-template";

const ASSETS_BASE = "https://solicitacoes.portalsvn.com.br/assinatura_email";

const CARTAO_BOAS_VINDAS_TEMPLATE: ArtTemplate = {
  tipo: 'cartao-boas-vindas',
  canvas: { width: 1446, height: 1770 },
  bg: {
    type: 'variant',
    variants: {
      padrao:  'cartao_boas_vindas/bg-welcome-padrao.png',
      private: 'cartao_boas_vindas/bg-welcome-private.png',
    },
    variant_source: 'is_private_key',
  },
  layers: [
    {
      id: 'nome_cliente', name: 'Nome do cliente', type: 'text-line',
      x: 338, y: 188, w: 764,
      content: '{{nome_cliente}}',
      font_family: 'Taviraj Light', font_size: 70, color: '#FFF8F3', align: 'center',
    },
    {
      id: 'frase_inicial', name: 'Frase inicial', type: 'text-line',
      x: 296, y: 278, w: 848,
      content: 'Que privilégio ter você conosco na SVN!',
      font_family: 'Taviraj Light', font_size: 40, color: '#FFF8F3', align: 'center',
    },
    {
      id: 'mensagem', name: 'Mensagem', type: 'text-block',
      x: 297, y: 528, w: 847, h: 596,
      content:
        'Acreditamos que cada cliente é único e estamos dedicados a entender suas necessidades, fornecendo a assessoria necessária para maximizar seus resultados financeiros. Nossa equipe de especialistas está sempre à disposição para oferecer consultoria de qualidade, análise de mercado e estratégias de investimento sob medida.\n\n' +
        'Na {{contrato_label}}, nossa missão é proporcionar as melhores soluções financeiras e orientações personalizadas para alcançar seus objetivos de investimento. Nosso compromisso é com a transparência, a confiança e a excelência no atendimento.\n\n' +
        'Estamos animados para iniciar esta jornada com você!',
      font_family: 'Nunito Sans Light',
      font_size: 37, line_height: 45, paragraph_spacing: 20,
      color: '#221B19', align: 'center',
    },
    {
      id: 'frase_boas_vindas', name: 'Frase de boas-vindas', type: 'text-line',
      x: 297, y: 1169, w: 847,
      content: 'Bem-vindo(a) à {{contrato_label}}.',
      font_family: 'Nunito Sans Light', font_size: 35, color: '#221B19', align: 'center',
    },
    {
      id: 'nome_assinatura', name: 'Nome para assinatura', type: 'text-line',
      x: 349, y: 1281, w: 743,
      content: '{{nome_assinatura}}',
      font_family: 'Taviraj Light', font_size: 40, color: '#221B19', align: 'center',
    },
    {
      id: 'unidade', name: 'Unidade', type: 'text-line',
      x: 349, y: 1346, w: 743,
      content: '{{unidade}}',
      font_family: 'Taviraj Light', font_size: 40, color: '#221B19', align: 'center',
    },
    {
      id: 'logo', name: 'Logo', type: 'image',
      x: 419, y: 1585, w: 603, h: 62,
      source: {
        type: 'variant',
        variants: {
          'svn-investimentos': `${ASSETS_BASE}/assinaturas_assinatura_svn.png`,
          'svn-capital':       `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_capital.png`,
          'svn-connect':       `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_connect.png`,
        },
        variant_source: 'contrato_social',
      },
      blend_mode: 'screen',
      resize_mode: 'contain',
    },
  ],
};

const ASSINATURA_EMAIL_TEMPLATE: ArtTemplate = {
  tipo: 'assinatura-email',
  canvas: { width: 4078, height: 988 },
  bg: {
    type: 'static',
    url: `${ASSETS_BASE}/bg_assinatura.png`,
  },
  layers: [
    {
      id: 'logo', name: 'Logo da marca', type: 'image',
      x: 284, y: 444, w: 0, h: 0,
      source: {
        type: 'variant',
        variants: {
          'svn-investimentos':           `${ASSETS_BASE}/assinaturas_assinatura_svn.png`,
          'svn-capital':                 `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_capital.png`,
          'svn-connect':                 `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_connect.png`,
          'svn-gestao':                  `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_gestao.png`,
          'svn-global':                  `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_global.png`,
          'svn-imb':                     `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_imb.png`,
          'svn-agro-cambio-commodities': `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_agro_cambio_commodities.png`,
          'svn-protecao-patrimonial':    `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_protecaopatrimonial.png`,
          'svn-wealth-planning':         `${ASSETS_BASE}/assinaturas_assinatura_logo_svn_wealthplanning.png`,
        },
        variant_source: 'marca',
      },
      blend_mode: 'screen',
    },
    {
      id: 'linha', name: 'Linha divisória', type: 'image',
      x: 1756, y: 341, w: 0, h: 0,
      source: { type: 'static', url: `${ASSETS_BASE}/assinatura_linha.png` },
      blend_mode: 'screen',
    },
    {
      id: 'nome', name: 'Nome', type: 'text-line',
      x: 2007, y: 210, w: 1373,
      content: '{{nome}}',
      font_family: 'Ivy Journal Light', font_size: 149, color: '#FFF8F3', align: 'left',
      auto_fit: { enabled: true, min_font_size: 90 },
    },
    {
      id: 'cargo', name: 'Cargo', type: 'text-line',
      x: 2007, y: 345, w: 1373,
      content: '{{cargo}}',
      font_family: 'Roobert PRO TRIAL Light', font_size: 64, color: '#FFF8F3', align: 'left',
    },
    {
      id: 'telefone', name: 'Telefone', type: 'text-line',
      x: 2005, y: 447, w: 1373,
      content: '{{telefone}}',
      font_family: 'Roobert PRO TRIAL Light', font_size: 64, color: '#FFF8F3', align: 'left',
    },
    {
      id: 'email', name: 'E-mail', type: 'text-line',
      x: 2005, y: 562, w: 1373,
      content: '{{email}}',
      font_family: 'Roobert PRO TRIAL Light', font_size: 64, color: '#FFF8F3', align: 'left',
      auto_fit: { enabled: true, min_font_size: 42 },
    },
    {
      id: 'cfp', name: 'Selo CFP', type: 'image',
      x: 2007, y: 676, w: 0, h: 0,
      source: {
        type: 'variant',
        variants: {
          sim: `${ASSETS_BASE}/assinatura_selo_cfp.png`,
          nao: '',
        },
        variant_source: 'tem_cfp',
      },
      blend_mode: 'screen',
    },
    {
      id: 'selos', name: 'Selos', type: 'image',
      x: 3400, y: 240, w: 0, h: 0,
      source: { type: 'static', url: `${ASSETS_BASE}/assinatura_selos.png` },
      blend_mode: 'screen',
    },
  ],
};

async function seed() {
  const templates = [CARTAO_BOAS_VINDAS_TEMPLATE, ASSINATURA_EMAIL_TEMPLATE];

  for (const template of templates) {
    await db
      .insert(artTemplatesTable)
      .values({
        tipo: template.tipo,
        config: template as any,
        updated_at: new Date(),
      })
      .onConflictDoUpdate({
        target: artTemplatesTable.tipo,
        set: {
          config: sql`EXCLUDED.config`,
          updated_at: sql`NOW()`,
        },
      });
    console.log(`✓ Template "${template.tipo}" inserido/atualizado`);
  }

  console.log('Seed concluído.');
  process.exit(0);
}

seed().catch((err) => {
  console.error('Erro no seed:', err);
  process.exit(1);
});
