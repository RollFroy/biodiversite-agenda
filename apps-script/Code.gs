const CONFIG = {
  calendarName: 'Biodiversité',
  dataUrl: 'https://raw.githubusercontent.com/RollFroy/biodiversite-agenda/main/data/biodiversite.json',
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
 * Diagnostic sans aucune écriture dans Google Agenda.
 * Vérifie :
 *  - que le calendrier "Biodiversité" est accessible en écriture ;
 *  - que les six libellés existent ;
 *  - que le JSON GitHub est accessible et cohérent.
 */
function diagnostic() {
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

  const calendar = matches[0];
  console.log('Calendrier trouvé : ' + calendar.summary);
  console.log('ID : ' + calendar.id);
  console.log('Droit : ' + calendar.accessRole);
  console.log('Fuseau : ' + (calendar.timeZone || '(non indiqué)'));

  const calendarResource = Calendar.Calendars.get(calendar.id);
  const labels =
    (calendarResource.labelProperties &&
      calendarResource.labelProperties.eventLabels) || [];

  console.log('Libellés détectés :');
  labels.forEach(label => {
    console.log(
      ' - ' + (label.name || '(sans nom)') +
      ' | id=' + label.id +
      ' | couleur=' + label.backgroundColor
    );
  });

  const labelNames = new Set(labels.map(label => label.name));
  const missingLabels = CONFIG.expectedLabels.filter(
    name => !labelNames.has(name)
  );

  if (missingLabels.length) {
    throw new Error(
      'Libellés manquants : ' + missingLabels.join(', ')
    );
  }

  const response = UrlFetchApp.fetch(CONFIG.dataUrl, {
    muteHttpExceptions: true,
  });

  if (response.getResponseCode() !== 200) {
    throw new Error(
      'Impossible de lire le JSON GitHub. HTTP ' +
      response.getResponseCode()
    );
  }

  const data = JSON.parse(response.getContentText('UTF-8'));

  if (data.schema_version !== 1) {
    throw new Error(
      'schema_version inattendu : ' + data.schema_version
    );
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

  console.log(
    'JSON GitHub OK : ' + data.events.length + ' événement(s).'
  );
  console.log('Diagnostic terminé : aucune donnée n’a été modifiée.');
}
