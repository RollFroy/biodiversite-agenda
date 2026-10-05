# Apps Script — synchronisation Biodiversité

Le script synchronise `data/biodiversite.json` vers le calendrier Google **Biodiversité**.

## Principes de sécurité

- aucune suppression automatique ;
- aucun événement terminé déjà présent n'est modifié visiblement ;
- le libellé d'un événement existant n'est jamais réécrit ;
- les notes personnelles sont préservées ;
- les anciens événements importés peuvent être **adoptés** grâce à leur `legacy_uid` iCalendar, sans modification visible ;
- `previewSync()` permet de contrôler toutes les actions avant écriture.

## Mise à jour du projet Apps Script

1. Connecte-toi avec le compte Google associé à `automatisation@de-piedoue.fr`.
2. Ouvre **Biodiversité Sync**.
3. Vérifie que **Google Calendar API** est présent dans **Services**.
4. Remplace `Code.gs` par la version du dépôt.
5. Vérifie aussi `appsscript.json`.
6. Enregistre.

## Ordre recommandé

### 1. `diagnostic()`

Vérifie l'accès au calendrier, les six libellés et le JSON GitHub. Aucune écriture.

### 2. `previewSync()`

Le journal peut afficher :

- `[ADOPTER]` : événement déjà présent retrouvé par son ancien UID iCalendar ;
- `[CRÉER]` : événement absent à créer ;
- `[METTRE À JOUR]` : événement futur déjà géré dont un champ public a changé ;
- `[IDENTIQUE]` : aucune différence ;
- `[IGNORÉ — PASSÉ]` : événement terminé déjà adopté.

Aucune écriture.

### 3. `syncBiodiversite()`

- une adoption ajoute seulement la propriété privée `biodiversiteSyncId` ;
- une création applique `initial_label` ;
- les événements existants importés avec `managed_fields` ne laissent au script modifier que les champs explicitement listés.

Après une première synchronisation de migration, relance `previewSync()` : les événements historiques adoptés doivent apparaître comme passés/ignorés, tandis que les événements futurs sont comparés normalement.

## Libellés

`initial_label` n'est utilisé qu'à la création. Ensuite, le libellé Google est sous ton contrôle et n'est jamais remplacé automatiquement.

Libellés actuels : **À surveiller, À envisager, Inscrit, Participé, Manqué, Annulé**.

## Notes personnelles

Pour les nouveaux événements créés par le script, la description prend la forme :

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

La partie **Notes personnelles** est conservée lors des mises à jour.
