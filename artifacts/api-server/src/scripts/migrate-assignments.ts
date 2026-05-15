import { db, usersTable, userTipoAssignmentsTable } from "@workspace/db";
import { eq } from "drizzle-orm";

// Env vars de atribuição descobertos em clickup.ts:
//   CLICKUP_ASSIGNEE_GERAL      → todos os tipos sem assignee específico
//   CLICKUP_ASSIGNEE_EVENTOS    → tipo "eventos"
//   CLICKUP_ASSIGNEE_PATROCINIO → tipo "patrocinio"
//   CLICKUP_ASSIGNEE_BRINDES    → tipo "brindes"

const TIPOS_GERAL = [
  "apresentacao-nova",
  "apresentacao-atualizar",
  "atualizacao-material",
  "artes-divulgacao",
  "cartao-visita-fisico",
  "criacao-pdf",
  "email-marketing",
  "materiais-impressos",
  "outro",
  "pagina-assessores",
  "pagina-online",
  "producao-video",
  "sessao-fotos",
];

const MAPPINGS: Record<string, string | undefined> = {
  eventos:    process.env.CLICKUP_ASSIGNEE_EVENTOS,
  patrocinio: process.env.CLICKUP_ASSIGNEE_PATROCINIO,
  brindes:    process.env.CLICKUP_ASSIGNEE_BRINDES,
  ...Object.fromEntries(TIPOS_GERAL.map(t => [t, process.env.CLICKUP_ASSIGNEE_GERAL])),
};

async function migrate() {
  let created = 0, reused = 0, assigned = 0;

  for (const [tipo, clickupId] of Object.entries(MAPPINGS)) {
    if (!clickupId) {
      console.log(`⊘ Skipping ${tipo}: env var não definido`);
      continue;
    }

    let user = await db.query.usersTable.findFirst({
      where: eq(usersTable.clickup_user_id, clickupId),
    });

    if (!user) {
      const placeholderEmail = `clickup_stub_${clickupId}@svn.internal`;
      const existing = await db.query.usersTable.findFirst({
        where: eq(usersTable.email, placeholderEmail),
      });
      if (existing) {
        user = existing;
        reused++;
        console.log(`✓ Stub existente ${user.id} reutilizado para ${tipo} (ClickUp ID ${clickupId})`);
      } else {
        const [stub] = await db.insert(usersTable).values({
          clickup_user_id: clickupId,
          email: placeholderEmail,
          name: `Assignee ClickUp ${clickupId}`,
          role: "colaborador",
        }).returning();
        user = stub;
        created++;
        console.log(`+ Stub criado para ClickUp ID ${clickupId} → user.id=${user.id} (tipo ${tipo})`);
      }
    } else {
      reused++;
      console.log(`✓ User existente ${user.id} (${user.email}) reutilizado para ${tipo}`);
    }

    await db.insert(userTipoAssignmentsTable)
      .values({ user_id: user.id, tipo })
      .onConflictDoNothing();

    assigned++;
  }

  console.log(`\n✓ Migração concluída: ${created} stubs criados, ${reused} reutilizados, ${assigned} atribuições aplicadas`);
}

migrate().then(() => process.exit(0)).catch(err => {
  console.error("Erro na migração:", err);
  process.exit(1);
});
