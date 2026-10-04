const CONFIG = {
  calendarName: 'Biodiversité',
  dataUrl: 'https://raw.githubusercontent.com/RollFroy/biodiversite-agenda/main/data/biodiversite.json',
  syncProperty: 'biodiversiteSyncId',
  personalNotesMarker: '── Notes personnelles ──',
  managedInfoHeader: '── Informations veille ──',
  expectedLabels: [
    'À surveiller',
    'À envisager',
    'Inscrit',
    'Participé',
    'Manqué',
    'Annulé',
  ],
};

/**
 * Diagnostic sans écriture dans Google Agenda.
 */
function diagnostic() {
  const calendar = getTargetCalendar_();
  const labels = getLabelMap_(calendar.id);
  const data = loadData_();
  validateData_(data, labels);

  console.log('Calendrier trouvé : ' + calendar.summary);
  console.log('ID : ' + calendar.id);
  console.log('Droit : ' + calendar.accessRole);
  console.log('Fuseau : ' + (calendar.timeZone || '(non indiqué)'));
  console.log('Libellés détectés : ' + Object.keys(labels).join(', '));
  console.log('JSON GitHub OK : ' + data.events.length + ' événement(s).');
  console.log('Diagnostic terminé : aucune donnée n’a été modifiée.');
}

/**
 * Simule la synchronisation et écrit seulement le plan d'action dans le journal.
 * Aucune modification n'est effectuée.
 */
function previewSync() {
  runSync_(true);
}

/**
 * Synchronise les événements du JSON GitHub vers le calendrier Biodiversité.
 *
 * Règles de sécurité :
 * - ne supprime jamais d'événement ;
 * - ne modifie jamais un événement terminé ;
 * - ne modifie jamais le libellé d'un événement existant ;
 * - préserve la section "Notes personnelles" ;
 * - ne gère que les événements portant notre propriété privée de synchronisation.
 */
function syncBiodiversite() {
  runSync_(false);
}

function runSync_(dryRun) {
  const calendar = getTargetCalendar_();
  const labels = getLabelMap_(calendar.id);
  const data = loadData_();
  validateData_(data, labels);

  const stats = {
    create: 0,
    update: 0,
    unchanged: 0,
    past: 0,
  };

  data.events.forEach(sourceEvent => {
    const existing = findManagedEvent_(calendar.id, sourceEvent.id);

    if (!existing) {
      stats.create++;
      if (dryRun) {
        console.log('[CRÉER] ' + sourceEvent.title + ' (' + sourceEvent.id + ')');
      } else {
        createManagedEvent_(calendar.id, sourceEvent, labels);
        console.log('[CRÉÉ] ' + sourceEvent.title + ' (' + sourceEvent.id + ')');
      }
      return;
    }

    if (isEnded_(existing)) {
      stats.past++;
      console.log('[IGNORÉ — PASSÉ] ' + existing.summary + ' (' + sourceEvent.id + ')');
      return;
    }

    const patchResult = buildPatch_(sourceEvent, existing);

    if (patchResult.changedFields.length === 0) {
      stats.unchanged++;
      console.log('[IDENTIQUE] ' + existing.summary + ' (' + sourceEvent.id + ')');
      return;
    }

    stats.update++;
    const fields = patchResult.changedFields.join(', ');

    if (dryRun) {
      console.log('[METTRE À JOUR] ' + existing.summary + ' — ' + fields);
    } else {
      Calendar.Events.patch(
        patchResult.resource,
        calendar.id,
        existing.id,
        { sendUpdates: 'none' }
      );
      console.log('[MIS À JOUR] ' + existing.summary + ' — ' + fields);
    }
  });

  console.log(
    (dryRun ? 'APERÇU' : 'SYNCHRO') +
    ' terminé — créations: ' + stats.create +
    ', mises à jour: ' + stats.update +
    ', identiques: ' + stats.unchanged +
    ', passés ignorés: ' + stats.past + '.'
  );
}

function getTargetCalendar_() {
  const list = Calendar.CalendarList.list({
    minAccessRole: 'writer',
    showHidden: true,
  });

  const calendars = list.items || [];
  const matches = calendars.filter(c => c.summary === CONFIG.calendarName);

  if (matches.length === 0) {
    throw new Error(
      'Calendrier "' + CONFIG.calendarName +
      '" introuvable avec un droit d\'écriture pour ce compte.'
    );
  }

  if (matches.length > 1) {
    throw new Error(
      'Plusieurs calendriers portent le nom "' + CONFIG.calendarName +
      '". Utilise leur ID pour lever l\'ambiguïté.'
    );
  }

  return matches[0];
}

function getLabelMap_(calendarId) {
  const calendarResource = Calendar.Calendars.get(calendarId);
  const eventLabels =
    (calendarResource.labelProperties &&
      calendarResource.labelProperties.eventLabels) || [];

  const labels = {};
  eventLabels.forEach(label => {
    if (label.name) {
      labels[label.name] = label;
    }
  });

  const missingLabels = CONFIG.expectedLabels.filter(name => !labels[name]);
  if (missingLabels.length) {
    throw new Error('Libellés manquants : ' + missingLabels.join(', '));
  }

  return labels;
}

function loadData_() {
  const response = UrlFetchApp.fetch(CONFIG.dataUrl, {
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(
      'Impossible de lire le JSON GitHub. HTTP ' + response.getResponseCode()
    );
  }

  return JSON.parse(response.getContentText('UTF-8'));
}

function validateData_(data, labels) {
  if (data.schema_version !== 1) {
    throw new Error('schema_version inattendu : ' + data.schema_version);
  }

  if (data.calendar !== CONFIG.calendarName) {
    throw new Error(
      'Le JSON vise le calendrier "' + data.calendar +
      '" au lieu de "' + CONFIG.calendarName + '".'
    );
  }

  if (!Array.isArray(data.events)) {
    throw new Error('Le champ events doit être un tableau.');
  }

  const ids = new Set();

  data.events.forEach((event, index) => {
    const prefix = 'events[' + index + ']';

    if (!event.id || typeof event.id !== 'string') {
      throw new Error(prefix + ' : id manquant ou invalide.');
    }
    if (ids.has(event.id)) {
      throw new Error(prefix + ' : id dupliqué : ' + event.id);
    }
    ids.add(event.id);

    if (!event.title || typeof event.title !== 'string') {
      throw new Error(prefix + ' : title manquant ou invalide.');
    }

    validateDateEndpoint_(event.start, prefix + '.start');
    validateDateEndpoint_(event.end, prefix + '.end');

    const initialLabel = event.initial_label || 'À surveiller';
    if (!labels[initialLabel]) {
      throw new Error(
        prefix + ' : initial_label inconnu : ' + initialLabel
      );
    }
  });
}

function validateDateEndpoint_(endpoint, fieldName) {
  if (!endpoint || typeof endpoint !== 'object') {
    throw new Error(fieldName + ' manquant.');
  }

  const hasDate = typeof endpoint.date === 'string';
  const hasDateTime = typeof endpoint.dateTime === 'string';

  if (hasDate === hasDateTime) {
    throw new Error(
      fieldName + ' doit contenir exactement date OU dateTime.'
    );
  }

  if (hasDate && !/^\d{4}-\d{2}-\d{2}$/.test(endpoint.date)) {
    throw new Error(fieldName + '.date doit être au format YYYY-MM-DD.');
  }

  if (hasDateTime && isNaN(new Date(endpoint.dateTime).getTime())) {
    throw new Error(fieldName + '.dateTime est invalide.');
  }
}

function findManagedEvent_(calendarId, syncId) {
  const result = Calendar.Events.list(calendarId, {
    privateExtendedProperty: CONFIG.syncProperty + '=' + syncId,
    showDeleted: false,
    singleEvents: true,
    maxResults: 2,
  });

  const items = result.items || [];

  if (items.length > 1) {
    throw new Error(
      'Plusieurs événements Google portent le même identifiant de synchro : ' +
      syncId
    );
  }

  return items.length === 1 ? items[0] : null;
}

function createManagedEvent_(calendarId, sourceEvent, labels) {
  const initialLabel = sourceEvent.initial_label || 'À surveiller';
  const resource = {
    summary: sourceEvent.title,
    start: normalizeDateEndpoint_(sourceEvent.start),
    end: normalizeDateEndpoint_(sourceEvent.end),
    description: buildManagedDescription_(sourceEvent, ''),
    extendedProperties: {
      private: {},
    },
    eventLabelId: labels[initialLabel].id,
  };

  resource.extendedProperties.private[CONFIG.syncProperty] = sourceEvent.id;

  if (sourceEvent.location) {
    resource.location = sourceEvent.location;
  }

  Calendar.Events.insert(resource, calendarId, {
    eventLabelVersion: 1,
    sendUpdates: 'none',
  });
}

function buildPatch_(sourceEvent, existing) {
  const resource = {};
  const changedFields = [];

  if ((existing.summary || '') !== sourceEvent.title) {
    resource.summary = sourceEvent.title;
    changedFields.push('titre');
  }

  const desiredLocation = sourceEvent.location || '';
  if ((existing.location || '') !== desiredLocation) {
    resource.location = desiredLocation;
    changedFields.push('lieu');
  }

  const desiredStart = normalizeDateEndpoint_(sourceEvent.start);
  if (!sameDateEndpoint_(desiredStart, existing.start)) {
    resource.start = desiredStart;
    changedFields.push('début');
  }

  const desiredEnd = normalizeDateEndpoint_(sourceEvent.end);
  if (!sameDateEndpoint_(desiredEnd, existing.end)) {
    resource.end = desiredEnd;
    changedFields.push('fin');
  }

  const desiredDescription = buildManagedDescription_(
    sourceEvent,
    existing.description || ''
  );

  if ((existing.description || '') !== desiredDescription) {
    resource.description = desiredDescription;
    changedFields.push('informations veille');
  }

  return { resource, changedFields };
}

function normalizeDateEndpoint_(endpoint) {
  if (endpoint.date) {
    return { date: endpoint.date };
  }

  const result = { dateTime: endpoint.dateTime };
  if (endpoint.timeZone) {
    result.timeZone = endpoint.timeZone;
  }
  return result;
}

function sameDateEndpoint_(desired, existing) {
  if (!existing) return false;

  if (desired.date) {
    return desired.date === existing.date;
  }

  if (!existing.dateTime) {
    return false;
  }

  return (
    new Date(desired.dateTime).getTime() ===
    new Date(existing.dateTime).getTime()
  );
}

function isEnded_(event) {
  if (!event.end) return false;

  if (event.end.dateTime) {
    return new Date(event.end.dateTime).getTime() <= Date.now();
  }

  if (event.end.date) {
    const today = Utilities.formatDate(
      new Date(),
      CONFIG_TIMEZONE_(),
      'yyyy-MM-dd'
    );
    return event.end.date <= today;
  }

  return false;
}

function CONFIG_TIMEZONE_() {
  return Session.getScriptTimeZone() || 'Europe/Paris';
}

function buildManagedDescription_(sourceEvent, currentDescription) {
  const lines = [CONFIG.managedInfoHeader];

  if (sourceEvent.type) {
    lines.push('Type : ' + sourceEvent.type);
  }
  if (sourceEvent.organizer) {
    lines.push('Organisme : ' + sourceEvent.organizer);
  }
  if (sourceEvent.priority) {
    lines.push('Priorité : ' + sourceEvent.priority);
  }
  if (sourceEvent.source_url) {
    lines.push('Source : ' + sourceEvent.source_url);
  }
  if (sourceEvent.description) {
    lines.push('');
    lines.push(sourceEvent.description);
  }

  const personalNotes = extractPersonalNotes_(currentDescription);

  return (
    lines.join('\n').trimEnd() +
    '\n\n' + CONFIG.personalNotesMarker +
    (personalNotes ? '\n' + personalNotes : '')
  );
}

function extractPersonalNotes_(description) {
  if (!description) return '';

  const markerIndex = description.indexOf(CONFIG.personalNotesMarker);

  if (markerIndex === -1) {
    // Garde-fou : si le marqueur a été supprimé manuellement,
    // on conserve tout le texte existant au lieu de le perdre.
    return description.trim();
  }

  return description
    .slice(markerIndex + CONFIG.personalNotesMarker.length)
    .replace(/^\s+/, '')
    .trimEnd();
}
