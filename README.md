# Le Chalet Sciez — application de contrats

Application web installable sur iPhone (écran d'accueil) pour créer les contrats de location saisonnière des réservations directes.

- Statique, sans serveur : `index.html`, `app.js`, `contrat-pdf.js` (calculs et mise en page du PDF avec pdfmake).
- Les contrats, les coordonnées des locataires, celles du bailleur et la signature restent sur l'appareil (stockage local du navigateur). Rien n'est envoyé sur Internet et rien de personnel ne figure dans ce dépôt.
- Les coordonnées du bailleur et la signature se chargent dans l'app depuis un fichier de réglages (Réglages → Importer), qui ne doit jamais être ajouté au dépôt.
- Fonctionne hors ligne après une première ouverture (`sw.js`).

Installation sur iPhone : ouvrir l'adresse du site dans Safari, bouton Partager, « Sur l'écran d'accueil ».
