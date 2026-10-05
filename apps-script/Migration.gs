const MIGRATION_STATUS_BY_SYNC_ID = {
  'lpo-cen-ilots-loire-2026-09-02': 'Participé',
  'lpo-ecole-ornithologie-donnery-2026-09': 'Manqué',
  'lpo-hibernaculum-dardilly-2026-09-30': 'Participé',
  'lpo-noctules-tete-or-2026-10-01': 'Annulé',
  'arthropologia-recolte-moi-si-tu-peux-cloture-2026-10-03': 'Participé',
  'fogefor-bfc-terrain-2026-11-05': 'Inscrit',
  'reseau-rhone-saone-lones-2026-11-12': 'À surveiller',
};

/**
 * Aperçu de la migration ponctuelle :
 * - retire les anciens préfixes des titres en reprenant le titre propre du JSON ;
 * - applique un libellé uniquement lorsque le statut est explicitement connu.
 * Aucune écriture.
 */
function previewMigrationHistorique() {
  runMigrationHistorique_(true);
}

/**
 * Migration ponctuelle. À exécuter une seule fois après validation de l'aperçu.
 */
function migrationHistorique() {
  runMigrationHistorique_(false);
}

function runMigrationHistorique_(dryRun) {
  const calendar = getTargetCalendar_();
  const labels = getLabelMap_(calendar.id);
  const data = loadData_();
  validateData_(data, labels);

  let changed = 0;
  let unchanged = 0;
  let missing = 0;

  data.events.forEach(sourceEvent => {
    let existing = findManagedEvent_(calendar.id, sourceEvent.id);

    if (!existing && sourceEvent.legacy_uid) {
      existing = findLegacyEvent_(calendar.id, sourceEvent.legacy_uid);
    }

    if (!existing) {
      missing++;
      console.log('[MIGRATION — INTROUVABLE] ' + sourceEvent.title + ' (' + sourceEvent.id + ')');
      return;
    }

    const resource = {};
    const changes = [];

    if ((existing.summary || '') !== sourceEvent.title) {
      resource.summary = sourceEvent.title;
      changes.push('titre');
    }

    const desiredStatus = MIGRATION_STATUS_BY_SYNC_ID[sourceEvent.id];
    if (desiredStatus) {
      const desiredLabelId = labels[desiredStatus].id;
      if (existing.eventLabelId !== desiredLabelId) {
        resource.eventLabelId = desiredLabelId;
        changes.push('libellé=' + desiredStatus);
      }
    }

    if (changes.length === 0) {
      unchanged++;
      console.log('[MIGRATION — IDENTIQUE] ' + existing.summary + ' (' + sourceEvent.id + ')');
      return;
    }

    changed++;

    if (dryRun) {
      console.log('[MIGRATION — MODIFIER] ' + existing.summary + ' — ' + changes.join(', '));
      return;
    }

    Calendar.Events.patch(
      resource,
      calendar.id,
      existing.id,
      {
        eventLabelVersion: 1,
        sendUpdates: 'none',
      }
    );

    console.log('[MIGRATION — MODIFIÉ] ' + sourceEvent.title + ' — ' + changes.join(', '));
  });

  console.log(
    (dryRun ? 'APERÇU MIGRATION' : 'MIGRATION') +
    ' terminé — modifiés: ' + changed +
    ', identiques: ' + unchanged +
    ', introuvables: ' + missing + '.'
  );
}
