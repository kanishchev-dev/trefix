function buildInsertColumns(record) {
  return Object.keys(record)
    .map((column) => `"${column}"`)
    .join(', ');
}

function buildInsertPlaceholders(record) {
  return Object.keys(record)
    .map((column) => `:${column}`)
    .join(', ');
}

async function upsertByUniqueColumn(queryInterface, tableName, uniqueColumn, record, transaction) {
  const normalizedRecord = Object.fromEntries(Object.entries(record).filter(([, value]) => value !== undefined));
  const insertColumns = Object.keys(normalizedRecord);
  const updateColumns = insertColumns.filter((column) => column !== 'id' && column !== uniqueColumn);
  const replacements = {
    ...normalizedRecord,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  await queryInterface.sequelize.query(
    `
      INSERT INTO "${tableName}" (${buildInsertColumns(normalizedRecord)}, "created_at", "updated_at")
      VALUES (${buildInsertPlaceholders(normalizedRecord)}, :createdAt, :updatedAt)
      ON CONFLICT ("${uniqueColumn}") DO UPDATE
      SET ${updateColumns.map((column) => `"${column}" = EXCLUDED."${column}"`).join(', ')},
          "deleted_at" = NULL,
          "updated_at" = EXCLUDED."updated_at"
    `,
    {
      replacements,
      transaction,
    },
  );
}

async function syncJoinTable(queryInterface, tableName, leftColumn, leftId, rightColumn, rightIds, transaction) {
  if (rightIds.length === 0) {
    await queryInterface.sequelize.query(`DELETE FROM "${tableName}" WHERE "${leftColumn}" = :leftId`, {
      replacements: { leftId },
      transaction,
    });
    return;
  }

  await queryInterface.sequelize.query(
    `DELETE FROM "${tableName}" WHERE "${leftColumn}" = :leftId AND "${rightColumn}" NOT IN (:rightIds)`,
    {
      replacements: { leftId, rightIds },
      transaction,
    },
  );

  const now = new Date();
  await queryInterface.bulkInsert(
    tableName,
    rightIds.map((rightId) => ({
      [leftColumn]: leftId,
      [rightColumn]: rightId,
      created_at: now,
      updated_at: now,
    })),
    {
      transaction,
      ignoreDuplicates: true,
    },
  );
}

async function insertJoinRows(queryInterface, tableName, rows, transaction) {
  if (rows.length === 0) {
    return;
  }

  await queryInterface.bulkInsert(tableName, rows, {
    transaction,
    ignoreDuplicates: true,
  });
}

module.exports = {
  insertJoinRows,
  syncJoinTable,
  upsertByUniqueColumn,
};
