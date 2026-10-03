# Apps Script — synchronisation Biodiversité

Cette première version est volontairement **non destructive**.

## Test initial

1. Connecte-toi à Apps Script avec le compte Google associé à `geoffroy@de-piedoue.fr`.
2. Crée un nouveau projet, par exemple **Biodiversité Sync**.
3. Dans **Services**, ajoute **Google Calendar API**.
4. Copie `Code.gs` dans l'éditeur.
5. Ouvre les paramètres du projet et active l'affichage du fichier manifeste `appsscript.json`.
6. Remplace son contenu par celui fourni dans ce dossier.
7. Exécute la fonction `diagnostic`.
8. Accepte les autorisations demandées.
9. Consulte **Journal d'exécution**.

Le diagnostic ne crée, ne modifie et ne supprime aucun événement.

Il vérifie uniquement :
- l'accès en écriture au calendrier **Biodiversité** ;
- la présence des libellés : À surveiller, À envisager, Inscrit, Participé, Manqué, Annulé ;
- l'accès au fichier GitHub `data/biodiversite.json`.

La phase suivante ajoutera un droit OAuth d'écriture limité aux **événements** et non à la gestion des agendas ou des partages.
