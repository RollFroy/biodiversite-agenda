# Apps Script — synchronisation Biodiversité

Le script synchronise les événements du fichier GitHub `data/biodiversite.json` vers le calendrier Google **Biodiversité**.

## Principes de sécurité

- aucune suppression automatique ;
- aucun événement terminé n'est modifié ;
- le libellé d'un événement existant n'est jamais réécrit ;
- la section `── Notes personnelles ──` est préservée ;
- seuls les événements créés par le système et portant la propriété privée `biodiversiteSyncId` sont gérés ;
- avant toute vraie synchronisation, `previewSync()` permet de voir exactement ce qui serait créé ou modifié.

## Installation / mise à jour

1. Connecte-toi à Apps Script avec le compte Google associé à `automatisation@de-piedoue.fr`.
2. Ouvre le projet **Biodiversité Sync**.
3. Vérifie que **Google Calendar API** est ajouté dans **Services**.
4. Remplace `Code.gs` par la version du dépôt.
5. Affiche le fichier manifeste `appsscript.json` dans les paramètres du projet et remplace son contenu par la version du dépôt.
6. Enregistre.

Le manifeste demande :
- lecture des agendas accessibles (`calendar.readonly`) ;
- lecture/écriture des événements (`calendar.events`) ;
- lecture HTTPS du JSON GitHub (`script.external_request`).

Il ne demande pas le scope complet `calendar`.

## Ordre de test recommandé

### 1. `diagnostic()`

Vérifie :
- l'accès en écriture au calendrier **Biodiversité** ;
- la présence des libellés : À surveiller, À envisager, Inscrit, Participé, Manqué, Annulé ;
- l'accès à `data/biodiversite.json`.

Aucune écriture.

### 2. `previewSync()`

Affiche dans le journal :
- `[CRÉER]` pour les nouveaux événements ;
- `[METTRE À JOUR]` pour les événements futurs déjà gérés ;
- `[IDENTIQUE]` si rien ne change ;
- `[IGNORÉ — PASSÉ]` pour les événements terminés.

Aucune écriture.

### 3. `syncBiodiversite()`

Effectue réellement les créations et mises à jour annoncées par l'aperçu.

## Gestion des libellés

`initial_label` dans le JSON sert uniquement lors de la création d'un nouvel événement. Ensuite, le libellé Google devient une donnée personnelle : le script ne le modifie plus.

Exemples : `À surveiller`, `À envisager`, `Inscrit`, `Participé`, `Manqué`, `Annulé`.

## Notes personnelles

La description est structurée ainsi :

```text
── Informations veille ──
Type : ...
Organisme : ...
Priorité : ...
Source : ...

Description publique...

── Notes personnelles ──
Tes propres notes...
```

Lors d'une mise à jour, seule la partie **Informations veille** est régénérée ; la partie **Notes personnelles** est conservée.
