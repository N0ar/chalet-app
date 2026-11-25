/* Calculs et mise en page PDF du contrat (pdfmake). Aucune donnée ne quitte l'appareil. */
(function (root) {
  const C = { ink: '#1c2b30', mute: '#5d6f75', lake: '#1f5563', lake2: '#e8f0f1', wood: '#b07a45', line: '#d5dee0', soft: '#f5f8f8' };

  // ---------- utilitaires ----------
  const d = (iso) => { const [y, m, j] = iso.split('-').map(Number); return new Date(y, m - 1, j, 12); };
  const addDays = (iso, n) => { const x = d(iso); x.setDate(x.getDate() + n); return x; };
  const clean = (s) => s.replace(/[  ]/g, ' ');
  const eur = (n) => clean(new Intl.NumberFormat('fr-FR', { maximumFractionDigits: 2 }).format(n)) + ' €';
  const eurEn = (n) => '€' + new Intl.NumberFormat('en-GB', { maximumFractionDigits: 2 }).format(n);
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  const long = (x, loc) => clean(new Intl.DateTimeFormat(loc, { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' }).format(x)).replace(',', '');
  const mid = (x, loc) => clean(new Intl.DateTimeFormat(loc, { day: 'numeric', month: 'long', year: 'numeric' }).format(x));
  const short = (x) => cap(clean(new Intl.DateTimeFormat('fr-FR', { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' }).format(x)));
  const dmy = (iso) => iso.split('-').reverse().join('/');
  const num = (v) => { const n = parseFloat(String(v == null ? '' : v).replace(',', '.')); return isFinite(n) ? n : 0; };

  function compute(c) {
    const nuits = (c.arrivee && c.depart) ? Math.round((d(c.depart) - d(c.arrivee)) / 864e5) : 0;
    const pers = Math.round(num(c.personnes)), base = Math.round(num(c.basePers));
    const extra = Math.max(0, pers - base);
    const heb = nuits * num(c.prixNuit);
    const supp = extra * nuits * num(c.suppPers);
    const animaux = Math.round(num(c.animaux));
    const suppAnimaux = animaux > 0 ? num(c.suppAnimaux) : 0;
    const sousTotal = heb + supp + suppAnimaux;
    const menage = num(c.menage), remise = num(c.remiseMontant);
    const total = sousTotal + menage - remise;
    const arrhes = Math.round(total * num(c.arrhesPct)) / 100;
    return { nuits, pers, base, extra, heb, supp, animaux, suppAnimaux, sousTotal, menage, remise, total, arrhes, solde: total - arrhes };
  }

  function check(c, s) {
    const k = compute(c), e = [];
    if (!c.loc.nom.trim()) e.push('Le nom du locataire est vide.');
    if (!c.arrivee || !c.depart) e.push('Les dates d’arrivée et de départ sont obligatoires.');
    else if (k.nuits < 1) e.push('Le départ doit être après l’arrivée.');
    if (k.pers < 1) e.push('Indiquez le nombre de personnes.');
    if (k.pers > num(s.capacite)) e.push('Le chalet accueille ' + s.capacite + ' personnes au maximum (bébés non comptés).');
    if (k.total <= 0 && k.nuits >= 1) e.push('Le total du séjour est nul : vérifiez le prix par nuit.');
    if (!s.bailleur.nom.trim()) e.push('Renseignez le bailleur dans les Réglages.');
    return e;
  }

  // ---------- briques de mise en page ----------
  // **gras** dans les textes
  const runs = (s) => s.split('**').map((t, i) => (i % 2 ? { text: t, bold: true, color: C.ink } : { text: t }));
  const fr = (s, m) => ({ text: runs(s), margin: m || [0, 0, 0, 3] });
  const tr = (en, es) => ({
    table: { widths: ['*', '*'], body: [[
      { text: [{ text: 'EN  ', bold: true, color: C.lake, fontSize: 5.8 }].concat(runs(en)) },
      { text: [{ text: 'ES  ', bold: true, color: C.lake, fontSize: 5.8 }].concat(runs(es)) }]] },
    layout: { hLineWidth: () => 0, vLineWidth: (i) => (i < 2 ? 1.2 : 0), vLineColor: () => C.line, paddingLeft: () => 6, paddingRight: () => 6, paddingTop: () => 0, paddingBottom: () => 0 },
    fontSize: 6.9, lineHeight: 1.18, color: C.mute, margin: [0, 1, 0, 5]
  });
  const h = (n, t, x) => ({ stack: [
    { columns: [{ width: 16, text: String(n), bold: true, color: C.wood, fontSize: 10.4 }, { width: '*', text: t, bold: true, color: C.lake, fontSize: 10.4 }, { width: 'auto', text: x, fontSize: 7, color: C.mute, margin: [0, 3, 0, 0] }] },
    { canvas: [{ type: 'line', x1: 0, y1: 2, x2: 511, y2: 2, lineWidth: 0.6, lineColor: C.line }], margin: [0, 0, 0, 5] }], margin: [0, 9, 0, 0] });
  const sec = (items, breakable) => ({ stack: items, unbreakable: !breakable });
  const kv = (rows) => ({ table: { widths: [70, '*'], body: rows.map(([k, sub, v]) => [
    { stack: [{ text: k, fontSize: 6.9, color: C.mute }].concat(sub ? [{ text: sub, fontSize: 5.9, color: C.mute }] : []), lineHeight: 1.05 },
    { text: v, fontSize: 8.6 }]) }, layout: 'noBorders' });
  const card = (title, sub, rows) => ({ stack: [{ text: [{ text: title, bold: true, color: C.lake, fontSize: 8.6 }, { text: '  ·  ' + sub, color: C.mute, fontSize: 6.9 }], margin: [0, 0, 0, 4] }, kv(rows)], margin: [4, 3, 4, 3] });
  const boxed = { hLineWidth: () => 0.6, vLineWidth: () => 0.6, hLineColor: () => C.line, vLineColor: () => C.line };
  const none = [false, false, false, false];

  // ---------- document ----------
  function build(c, s, assets) {
    const k = compute(c), b = s.bailleur, L = c.loc;
    const arr = d(c.arrivee), dep = d(c.depart);
    const limAnnul = addDays(c.arrivee, -num(s.annulJours));
    const limRetour = addDays(c.etabliLe, num(s.delaiRetour));
    const J = num(s.annulJours), R = num(s.delaiRetour), kwh = num(s.kwh);
    const hA = s.heureArrivee, hD = s.heureDepart;
    const ev = (a, z) => Math.round(a * kwh) + ' à ' + Math.round(z * kwh) + ' €';
    const persTxt = k.pers + (k.pers > 1 ? ' personnes' : ' personne') + (num(c.bebes) > 0 ? ' + ' + num(c.bebes) + ' bébé' + (num(c.bebes) > 1 ? 's' : '') : '');
    const ref = c.arrivee;
    const price = [];
    const row = (main, small, amount, kind) => {
      const fill = kind === 'tot' ? C.lake : kind === 'pay' ? C.lake2 : kind === 'sub' ? C.soft : null;
      const col = kind === 'tot' ? '#ffffff' : C.ink, bold = !!kind;
      price.push([
        { stack: [{ text: main, bold, color: col, fontSize: kind === 'tot' ? 10 : 8.6 }, { text: small, fontSize: 6.7, color: kind === 'tot' ? '#d7e4e6' : C.mute }], fillColor: fill, lineHeight: 1.1 },
        { text: amount, alignment: 'right', bold: true, color: col, fillColor: fill, fontSize: kind === 'tot' ? 10 : 8.6, noWrap: true }]);
    };
    const n = k.nuits, ns = n > 1 ? 's' : '';
    row(n + ' nuit' + ns + ' × ' + eur(num(c.prixNuit)) + ' — tarif de base jusqu’à ' + k.base + ' personnes',
      n + ' night' + ns + ' × ' + eurEn(num(c.prixNuit)) + ', base rate for up to ' + k.base + ' guests  ·  ' + n + ' noche' + ns + ' × ' + eur(num(c.prixNuit)) + ', tarifa base hasta ' + k.base + ' personas', eur(k.heb));
    if (k.extra > 0) row(k.extra + ' personne' + (k.extra > 1 ? 's' : '') + ' supplémentaire' + (k.extra > 1 ? 's' : '') + ' × ' + n + ' nuit' + ns + ' × ' + eur(num(c.suppPers)),
      'Additional guests above ' + k.base + ', babies excluded  ·  Personas adicionales a partir de la ' + (k.base + 1) + '.ª, bebés excluidos', eur(k.supp));
    row('Animal de compagnie : ' + (k.animaux > 0 ? k.animaux : 'aucun'), 'Pets: ' + (k.animaux > 0 ? k.animaux : 'none') + '  ·  Mascotas: ' + (k.animaux > 0 ? k.animaux : 'ninguna'), eur(k.suppAnimaux));
    row('Sous-total hébergement', 'Accommodation subtotal  ·  Subtotal alojamiento', eur(k.sousTotal), 'sub');
    row('Ménage de fin de séjour et linge de maison', 'End-of-stay cleaning and linen  ·  Limpieza final y ropa de casa', eur(k.menage));
    if (k.remise > 0) row('Remise' + (c.remiseLibelle ? ' « ' + c.remiseLibelle + ' »' : ''), 'Discount  ·  Descuento', '− ' + eur(k.remise));
    row('Total du séjour', 'Total for the stay  ·  Total de la estancia', eur(k.total), 'tot');
    row('Arrhes (' + num(c.arrhesPct) + ' %), à verser à la réservation', 'Booking deposit, payable on booking  ·  Señal, a abonar al reservar', eur(k.arrhes), 'pay');
    row('Solde, à verser au plus tard le jour de l’arrivée', 'Balance, payable no later than the day of arrival  ·  Resto, a abonar como máximo el día de llegada', eur(k.solde), 'pay');

    const bandCell = (kk, v, sm) => ({ stack: [{ text: kk.toUpperCase(), fontSize: 5.8, color: '#c9dadd', characterSpacing: 0.6 }, { text: v, bold: true, fontSize: 9.6, color: '#ffffff', margin: [0, 2, 0, 0] }, { text: sm, fontSize: 7, color: '#d7e4e6' }], fillColor: C.lake, margin: [3, 3, 3, 3] });
    const emails = [b.email1, b.email2].filter(Boolean).join('\n');
    const locAdr = [L.adresse, [L.cpVille, L.pays].filter(Boolean).join(', ')].filter(Boolean).join('\n');

    const content = [
      { columns: [
        { width: 50, image: assets.logo, fit: [48, 48] },
        { width: '*', stack: [{ text: 'Le Chalet Sciez', bold: true, fontSize: 16, color: C.lake }, { text: '460 Route d’Excuvilly · 74140 Sciez\n' + s.site, fontSize: 7.8, color: C.mute }], margin: [8, 2, 0, 0] },
        { width: 'auto', stack: [{ text: 'CONTRAT DE LOCATION SAISONNIÈRE', bold: true, fontSize: 12, characterSpacing: 0.4 }, { text: 'SEASONAL RENTAL AGREEMENT\nCONTRATO DE ALQUILER VACACIONAL', fontSize: 7, color: C.mute, characterSpacing: 0.4 }, { text: 'Réf. ' + ref + ' · établi le ' + dmy(c.etabliLe), fontSize: 7.4, bold: true, color: C.wood, margin: [0, 3, 0, 0] }], alignment: 'right' }] },
      { canvas: [{ type: 'line', x1: 0, y1: 6, x2: 511, y2: 6, lineWidth: 1.5, lineColor: C.lake }] },
      { table: { widths: ['*', '*', 62, 78, 72], body: [[
        bandCell('Arrivée · Check-in', short(arr), 'à partir de ' + hA), bandCell('Départ · Check-out', short(dep), hD + ' au plus tard'),
        bandCell('Durée', n + ' nuit' + ns, 'nights · noches'), bandCell('Occupants', k.pers + ' pers.', 'guests · personas'), bandCell('Total séjour', eur(k.total), 'ménage inclus')]] },
        layout: { hLineWidth: () => 0, vLineWidth: (i) => (i > 0 && i < 5 ? 0.5 : 0), vLineColor: () => '#4d7782' }, margin: [0, 10, 0, 0] },

      sec([h(1, 'Les parties', 'The parties · Las partes'),
        { table: { widths: ['*', 8, '*'], body: [[
          card('Le bailleur', 'The lessor · El arrendador', [['Nom', 'Name · Nombre', b.nom], ['Adresse', 'Address · Dirección', [b.adresse1, b.adresse2].filter(Boolean).join('\n')], ['Téléphone', 'Phone · Teléfono', b.tel]].concat(emails ? [['E-mail', '', emails]] : [])),
          { text: '', border: none },
          card('Le locataire', 'The tenant · El arrendatario', [['Nom, prénom', 'Name · Nombre', L.nom], ['Adresse', 'Address · Dirección', locAdr || '—'], ['Téléphone', 'Phone · Teléfono', L.tel || '—'], ['E-mail', '', L.email || '—'], ['Occupants', 'Guests · Personas', persTxt]])]] },
          layout: boxed }]),

      sec([h(2, 'Le logement loué', 'The property · El alojamiento'),
        { columns: [{ width: '*', stack: [
          fr('**Chalet indépendant d’environ 100 m²**, 460 Route d’Excuvilly, 74140 Sciez (Haute-Savoie), loué meublé et équipé à usage exclusif de résidence de vacances. Meublé de tourisme non classé. **Capacité maximale : ' + s.capacite + ' personnes**, bébés non comptés.'),
          fr('Le nombre d’occupants ne peut dépasser celui indiqué au présent contrat sans l’accord écrit préalable du bailleur. Le locataire ne peut ni sous-louer ni céder le contrat, ni y établir sa résidence principale ou une activité professionnelle.'),
          tr('Detached chalet of approx. 100 m², rented furnished and equipped for holiday use only. Unclassified furnished tourist accommodation. Maximum capacity: ' + s.capacite + ' people, not counting babies. The number of occupants may not exceed the number stated in this agreement without the lessor’s prior written consent. No subletting, assignment, main residence or business use.',
            'Chalet independiente de unos 100 m², alquilado amueblado y equipado para uso exclusivamente vacacional. Alojamiento turístico sin clasificar. Capacidad máxima: ' + s.capacite + ' personas, sin contar bebés. El número de ocupantes no puede superar el indicado en este contrato sin el acuerdo previo por escrito del arrendador. Se prohíbe subarrendar, ceder el contrato o usarlo como residencia principal o profesional.')] },
        { width: 140, image: assets.photo, fit: [140, 100], margin: [10, 0, 0, 0] }] }]),
      { table: { headerRows: 1, dontBreakRows: true, widths: [58, 165, '*', '*'], body: [
        ['', 'ÉTAT DESCRIPTIF', 'DESCRIPTION', 'DESCRIPCIÓN'].map((t) => ({ text: t, bold: true, fontSize: 5.9, color: C.lake, characterSpacing: 0.5 })),
        ...[
          ['Rez-de-chaussée', 'Entrée, salon-séjour avec cuisine ouverte entièrement équipée (four, micro-ondes, réfrigérateur-congélateur, plaque vitrocéramique, lave-vaisselle), WC séparé, cellier avec lave-linge.', 'Ground floor: entrance hall, living room with fully equipped open kitchen (oven, microwave, fridge-freezer, ceramic hob, dishwasher), separate WC, utility room with washing machine.', 'Planta baja: entrada, salón-comedor con cocina abierta totalmente equipada (horno, microondas, frigorífico-congelador, vitrocerámica, lavavajillas), aseo independiente, trastero con lavadora.'],
          ['Étage', '3 chambres : deux avec un lit de 160 ; une avec un lit superposé (140 en bas, 90 en haut) et un lit séparé de 90. Salle d’eau avec double vasque, douche et WC.', 'Upstairs: 3 bedrooms — two with a 160 cm bed; one with a bunk bed (140 cm below, 90 cm above) and a separate 90 cm bed. Shower room with twin basins, shower and WC.', 'Planta alta: 3 dormitorios — dos con cama de 160; uno con litera (140 abajo, 90 arriba) y una cama individual de 90. Cuarto de baño con dos lavabos, ducha y aseo.'],
          ['Extérieur', 'Jardin non clos, stationnement pour 2 voitures, terrasse avec table et 6 chaises, 2 bains de soleil, 2 fauteuils, parasol, barbecue-plancha au gaz (bouteille fournie).', 'Unfenced garden, parking for 2 cars, terrace with table and 6 chairs, 2 sun loungers, 2 armchairs, parasol, gas barbecue-plancha (cylinder provided).', 'Jardín sin vallar, aparcamiento para 2 coches, terraza con mesa y 6 sillas, 2 tumbonas, 2 sillones, sombrilla, barbacoa-plancha de gas (bombona incluida).'],
          ['Linge', 'Draps, serviettes de toilette et torchons fournis.', 'Sheets, towels and tea towels provided.', 'Sábanas, toallas y paños de cocina incluidos.']
        ].map((r) => [{ text: r[0], bold: true, color: C.lake, fontSize: 7.2 }, { text: r[1], fontSize: 7.8 }, { text: r[2], fontSize: 7, color: C.mute }, { text: r[3], fontSize: 7, color: C.mute }])] },
        layout: { hLineWidth: (i) => (i === 0 ? 0 : i === 1 ? 0.8 : 0.5), hLineColor: (i) => (i === 1 ? C.lake : C.line), vLineWidth: () => 0, paddingTop: () => 3, paddingBottom: () => 3 }, lineHeight: 1.15, margin: [0, 4, 0, 0] },
      { text: 'Inventaire détaillé des équipements : ' + s.site + '  ·  Detailed equipment list on the website  ·  Inventario detallado en el sitio web.', fontSize: 6.9, color: C.mute, margin: [0, 5, 0, 0] },

      sec([h(3, 'Durée de la location', 'Rental period · Período de alquiler'),
        fr('La location est consentie du **' + long(arr, 'fr-FR') + ' à partir de ' + hA + '** au **' + long(dep, 'fr-FR') + ' à ' + hD + ' au plus tard**, soit ' + n + ' nuit' + ns + '. Elle n’est pas renouvelable : le locataire s’engage à libérer les lieux à la date et à l’heure convenues et ne peut se prévaloir d’aucun droit au maintien dans les lieux.'),
        tr('The rental runs from ' + long(arr, 'en-GB') + ' (from ' + hA + ') to ' + long(dep, 'en-GB') + ' (' + hD + ' at the latest), i.e. ' + n + ' night' + ns + '. It is not renewable: the tenant undertakes to vacate the property at the agreed date and time.',
          'El alquiler va del ' + long(arr, 'es-ES') + ' (a partir de las ' + hA + ') al ' + long(dep, 'es-ES') + ' (a las ' + hD + ' como máximo), es decir, ' + n + ' noche' + ns + '. No es prorrogable: el arrendatario se compromete a dejar el alojamiento en la fecha y hora acordadas.')]),

      sec([h(4, 'Prix', 'Price · Precio'),
        { table: { widths: ['*', 70], body: price }, layout: { hLineWidth: (i) => (i === 0 ? 0 : 0.5), hLineColor: () => C.line, vLineWidth: () => 0, paddingTop: () => 4, paddingBottom: () => 4, paddingLeft: () => 6, paddingRight: () => 6 } }]),

      sec([h(5, 'Réservation et paiement', 'Booking and payment · Reserva y pago'),
        fr('La réservation devient ferme à réception par le bailleur **des arrhes de ' + eur(k.arrhes) + '** et d’un exemplaire du présent contrat **paraphé sur chaque page, daté et signé** avec la mention « Lu et approuvé », au plus tard le **' + mid(limRetour, 'fr-FR') + '**, soit ' + R + ' jours après l’envoi du contrat. Passé ce délai, le bailleur peut disposer librement du logement. Le solde de **' + eur(k.solde) + '** est réglé au plus tard le jour de l’arrivée, avant la remise des clés. Règlements acceptés : virement bancaire (coordonnées communiquées par le bailleur), chèque ou espèces contre reçu.'),
        tr('The booking becomes firm once the lessor has received the ' + eurEn(k.arrhes) + ' booking deposit and a copy of this agreement initialled on every page, dated and signed with the words “Read and approved”, by ' + mid(limRetour, 'en-GB') + ' (' + R + ' days after the agreement is sent). After that date the lessor may let the property to someone else. The balance of ' + eurEn(k.solde) + ' is due no later than the day of arrival, before the keys are handed over. Payment by bank transfer (details supplied by the lessor), cheque or cash against receipt.',
          'La reserva es firme cuando el arrendador recibe la señal de ' + eur(k.arrhes) + ' y un ejemplar de este contrato rubricado en cada página, fechado y firmado con la mención «Leído y conforme», a más tardar el ' + mid(limRetour, 'es-ES') + ' (' + R + ' días después del envío del contrato). Pasado ese plazo, el arrendador puede disponer libremente del alojamiento. El resto de ' + eur(k.solde) + ' se abona como máximo el día de llegada, antes de la entrega de llaves. Pago por transferencia bancaria (datos facilitados por el arrendador), cheque o efectivo con recibo.')]),

      sec([h(6, 'Dépôt de garantie', 'Security deposit · Depósito de garantía'),
        fr('Un dépôt de garantie de **' + eur(num(c.depot)) + '** est remis à l’arrivée, par chèque, en espèces (contre reçu) ou par empreinte bancaire Swikly. Il n’est pas un acompte sur le prix. Il est restitué — ou l’empreinte levée — dans un délai maximal de **7 jours** après le départ, déduction faite, sur justificatifs, du coût de remise en état des dégradations, du remplacement des objets manquants ou détériorés et, le cas échéant, d’un ménage supplémentaire. Si le dépôt ne suffit pas, le locataire s’engage à régler la différence.'),
        tr('A security deposit of ' + eurEn(num(c.depot)) + ' is provided on arrival, by cheque, in cash (against receipt) or by Swikly card pre-authorisation. It is not a part-payment of the price. It is returned — or the pre-authorisation released — within 7 days of departure, less the documented cost of repairing any damage, replacing missing or damaged items and, where applicable, additional cleaning. If the deposit is insufficient, the tenant undertakes to pay the difference.',
          'Se entrega a la llegada un depósito de garantía de ' + eur(num(c.depot)) + ', mediante cheque, en efectivo (con recibo) o preautorización bancaria Swikly. No constituye un anticipo del precio. Se devuelve —o se libera la preautorización— en un plazo máximo de 7 días tras la salida, deducidos, con justificantes, los costes de reparación de daños, de reposición de objetos que falten o estén deteriorados y, en su caso, de una limpieza adicional. Si el depósito no basta, el arrendatario se compromete a abonar la diferencia.')]),

      sec([h(7, 'Annulation', 'Cancellation · Cancelación'),
        fr('**Par le locataire.** Toute annulation est notifiée par écrit (e-mail). **Jusqu’à ' + J + ' jours avant l’arrivée** (soit jusqu’au ' + mid(limAnnul, 'fr-FR') + ' inclus) : les arrhes sont intégralement remboursées. **Moins de ' + J + ' jours avant l’arrivée, ou en cas de non-présentation** : les arrhes restent acquises au bailleur. En cas de départ anticipé, le prix total reste dû.'),
        fr('**Motif grave.** Si l’annulation intervient moins de ' + J + ' jours avant l’arrivée pour un motif grave et justifié (raison de santé par exemple), les arrhes ne sont pas remboursées mais le séjour peut être reporté, selon disponibilités, dans les 12 mois suivant la date d’arrivée initiale ; les arrhes versées sont alors déduites du prix du nouveau séjour.'),
        fr('**Par le bailleur.** Si le bailleur est contraint d’annuler la location, il rembourse au locataire l’intégralité des sommes versées, arrhes comprises, sans autre indemnité.'),
        tr('**By the tenant** (in writing, by e-mail). Up to ' + J + ' days before arrival (until ' + mid(limAnnul, 'en-GB') + ' inclusive): the booking deposit is refunded in full. Less than ' + J + ' days before arrival, or no-show: the booking deposit is retained by the lessor. In case of early departure the full price remains due. **Serious reason.** If cancellation occurs less than ' + J + ' days before arrival for a serious, documented reason (e.g. health), the deposit is not refunded but the stay may be rescheduled, subject to availability, within 12 months of the original arrival date; the deposit paid is credited to the new stay. **By the lessor.** If the lessor has to cancel, all sums paid, including the booking deposit, are refunded to the tenant, with no further compensation.',
          '**Por el arrendatario** (por escrito, por correo electrónico). Hasta ' + J + ' días antes de la llegada (hasta el ' + mid(limAnnul, 'es-ES') + ' inclusive): se devuelve íntegramente la señal. Menos de ' + J + ' días antes de la llegada, o en caso de no presentarse: la señal queda en poder del arrendador. En caso de salida anticipada se debe el precio total. **Motivo grave.** Si la cancelación se produce menos de ' + J + ' días antes de la llegada por un motivo grave y justificado (por ejemplo, de salud), la señal no se devuelve, pero la estancia puede aplazarse, según disponibilidad, dentro de los 12 meses siguientes a la fecha de llegada inicial; la señal abonada se descuenta del nuevo alquiler. **Por el arrendador.** Si el arrendador se ve obligado a cancelar, reembolsa al arrendatario todas las cantidades abonadas, incluida la señal, sin otra indemnización.')]),

      sec([h(8, 'État des lieux et règlement intérieur', 'Inventory and house rules · Inventario y normas'),
        fr('Un état des lieux et un inventaire sont établis à l’arrivée et au départ, en présence des deux parties. Le locataire dispose de **24 heures** après son arrivée pour signaler par écrit toute anomalie non relevée. À défaut, le logement est réputé avoir été remis en bon état.'),
        tr('A check-in and check-out inspection and inventory are carried out with both parties present. The tenant has 24 hours after arrival to report in writing any defect not already noted; otherwise the property is deemed to have been handed over in good condition.',
          'Se realiza un inventario y una revisión del estado del alojamiento a la llegada y a la salida, en presencia de ambas partes. El arrendatario dispone de 24 horas tras la llegada para comunicar por escrito cualquier anomalía no señalada; de lo contrario, se considera que el alojamiento se entregó en buen estado.')]),
      { ul: [
        ['Le logement est tenu propre pendant tout le séjour et occupé paisiblement, dans le respect du voisinage. Les fêtes et événements sont interdits.', 'The property must be kept clean and used peacefully, with respect for the neighbours. Parties and events are not allowed. · El alojamiento debe mantenerse limpio y usarse de forma tranquila, respetando al vecindario. Se prohíben fiestas y eventos.'],
        ['**Il est strictement interdit de fumer à l’intérieur du chalet.** Tout manquement donne lieu à une retenue forfaitaire de **' + eur(num(s.tabac)) + '** sur le dépôt de garantie, au titre du nettoyage et de la désodorisation.', 'Smoking is strictly prohibited inside the chalet. Any breach will result in a flat ' + eurEn(num(s.tabac)) + ' deduction from the security deposit for cleaning and deodorising. · Está terminantemente prohibido fumar dentro del chalet. El incumplimiento dará lugar a una retención fija de ' + eur(num(s.tabac)) + ' del depósito por limpieza y desodorización.'],
        ['Les petits animaux de compagnie sont admis avec l’accord préalable du bailleur, moyennant un supplément de **' + eur(num(s.animalTarif == null ? 20 : s.animalTarif)) + '** par animal et par séjour. Le jardin n’est pas clos.', 'Small pets are welcome with the lessor’s prior consent, for a supplement of ' + eurEn(num(s.animalTarif == null ? 20 : s.animalTarif)) + ' per pet per stay. The garden is not fenced. · Se admiten mascotas pequeñas con el acuerdo previo del arrendador, con un suplemento de ' + eur(num(s.animalTarif == null ? 20 : s.animalTarif)) + ' por mascota y por estancia. El jardín no está vallado.'],
        ['Arrivée à partir de ' + hA + ', départ à ' + hD + ' au plus tard. Les clés sont remises et restituées en main propre.', 'Check-in from ' + hA + ', check-out by ' + hD + '. Keys are handed over and returned in person. · Llegada a partir de las ' + hA + ', salida a las ' + hD + ' como máximo. Las llaves se entregan y devuelven en mano.'],
        ['Au départ, bien que le ménage de fin de séjour soit compris : vaisselle lavée et rangée, barbecue nettoyé, poubelles vidées, draps retirés et déposés au pied des lits.', 'On departure, although end-of-stay cleaning is included: dishes washed and put away, barbecue cleaned, bins emptied, sheets stripped and left at the foot of the beds. · A la salida, aunque la limpieza final está incluida: vajilla lavada y guardada, barbacoa limpia, basura vaciada, sábanas retiradas y dejadas a los pies de las camas.']
      ].map((r) => ({ stack: [{ text: runs(r[0]) }, { text: r[1], fontSize: 6.9, color: C.mute, lineHeight: 1.15 }], unbreakable: true, margin: [0, 0, 0, 5] })), markerColor: C.wood },

      sec([h(9, 'Recharge de véhicule électrique', 'EV charging · Recarga de vehículo eléctrico'),
        fr('La recharge d’un véhicule électrique est autorisée et facturée en supplément **' + kwh.toFixed(2).replace('.', ',') + '\u00a0€ par kWh**, réglée au départ. À titre indicatif, pour une charge complète :'),
        { table: { widths: ['*', '*', '*'], body: [[[ev(30, 50), 'batterie de 30 à 50 kWh', 'small car · coche pequeño'], [ev(51, 80), 'batterie de 51 à 80 kWh', 'mid-size car · coche mediano'], [ev(81, 120), 'batterie de 81 à 120 kWh', 'large car · coche grande']]
          .map((x) => ({ stack: [{ text: x[0], bold: true, fontSize: 10, color: C.lake }, { text: x[1] + '\n' + x[2], fontSize: 6.9, color: C.mute }], alignment: 'center', margin: [0, 2, 0, 2] }))] }, layout: boxed, margin: [0, 2, 0, 5] },
        tr('Electric vehicle charging is allowed and billed separately at €' + kwh.toFixed(2) + ' per kWh, payable on departure. The amounts above are indicative, for a full charge.',
          'La recarga de vehículos eléctricos está permitida y se factura aparte a ' + kwh.toFixed(2).replace('.', ',') + '\u00a0€ por kWh, a abonar a la salida. Los importes indicados son orientativos, para una carga completa.')]),

      sec([h(10, 'Assurance et responsabilité', 'Insurance and liability · Seguro y responsabilidad'),
        fr('Le locataire use des lieux raisonnablement et répond des dégradations survenues pendant le séjour, de son fait ou du fait des occupants et de ses animaux. Il déclare être couvert par une assurance responsabilité civile incluant la garantie « villégiature » et en justifie sur simple demande.'),
        tr('The tenant uses the property with due care and is liable for any damage occurring during the stay caused by the tenant, the occupants or their pets. The tenant declares holding third-party liability insurance covering holiday rentals and will provide proof on request.',
          'El arrendatario hace un uso razonable del alojamiento y responde de los daños ocurridos durante la estancia, causados por él, por los ocupantes o por sus mascotas. Declara disponer de un seguro de responsabilidad civil que cubre alquileres vacacionales y lo acreditará si se le solicita.')]),

      sec([h(11, 'Dispositions générales', 'General provisions · Disposiciones generales'),
        fr('Le présent contrat est soumis au droit français. **Seule la version française fait foi** ; les traductions anglaise et espagnole sont fournies à titre d’information. En cas de litige, les parties recherchent d’abord une solution amiable. Les données personnelles du locataire sont utilisées uniquement pour la gestion de la location et ne sont pas transmises à des tiers, hors obligations légales.'),
        tr('This agreement is governed by French law. Only the French version is binding; the English and Spanish translations are provided for information. In case of dispute, the parties will first seek an amicable solution. The tenant’s personal data is used solely to manage the rental and is not shared with third parties, except where required by law.',
          'Este contrato se rige por el derecho francés. Solo la versión francesa es vinculante; las traducciones al inglés y al español se facilitan a título informativo. En caso de litigio, las partes buscarán primero una solución amistosa. Los datos personales del arrendatario se usan únicamente para gestionar el alquiler y no se ceden a terceros, salvo obligación legal.')]),

      sec([{ table: { widths: ['*', 12, '*'], heights: 108, body: [[
        { stack: [{ text: 'LE BAILLEUR', bold: true, color: C.lake, fontSize: 8.6, characterSpacing: 0.4 }, { text: 'THE LESSOR · EL ARRENDADOR', fontSize: 6.4, color: C.mute }, { text: b.nom + '\nFait le ' + dmy(c.etabliLe), margin: [0, 5, 0, 4] }].concat(s.signature ? [{ image: s.signature, fit: [150, 48] }] : []), margin: [5, 5, 5, 5] },
        { text: '', border: none },
        { stack: [{ text: 'LE LOCATAIRE', bold: true, color: C.lake, fontSize: 8.6, characterSpacing: 0.4 }, { text: 'THE TENANT · EL ARRENDATARIO', fontSize: 6.4, color: C.mute }, { text: L.nom + '\nFait à ____________________ , le ____ / ____ / ________', margin: [0, 5, 0, 4] }, { text: 'Signature précédée de la mention manuscrite « Lu et approuvé »\nSignature preceded by the handwritten words “Read and approved”\nFirma precedida de la mención manuscrita «Leído y conforme»', fontSize: 6.5, color: C.mute, lineHeight: 1.15 }], margin: [5, 5, 5, 5] }]] }, layout: boxed, margin: [0, 12, 0, 0] },
        { text: 'Contrat établi en deux exemplaires, un pour chaque partie.  ·  Made in two copies, one for each party.  ·  Hecho en dos ejemplares, uno para cada parte.', fontSize: 6.9, color: C.mute, margin: [0, 6, 0, 0] }])
    ];

    return {
      pageSize: 'A4', pageMargins: [42, 36, 42, 46],
      info: { title: 'Contrat de location saisonnière — Le Chalet Sciez', author: b.nom },
      defaultStyle: { fontSize: 8.6, lineHeight: 1.22, color: C.ink },
      footer: (p, t) => ({ margin: [42, 12, 42, 0], stack: [
        { canvas: [{ type: 'line', x1: 0, y1: 0, x2: 511, y2: 0, lineWidth: 0.5, lineColor: C.line }] },
        { columns: [
          { text: [{ text: 'Paraphes · Initials · Rúbricas  —  Bailleur : ' }, { text: b.initiales || '____', bold: true, color: C.ink }, { text: '      Locataire : ____________' }] },
          { text: 'Le Chalet Sciez · Contrat réf. ' + ref + '  —  page ' + p + ' / ' + t, alignment: 'right' }], fontSize: 6.4, color: C.mute, margin: [0, 5, 0, 0] }] }),
      content
    };
  }

  const fileName = (c) => 'Contrat-Chalet-Sciez-' + c.arrivee + '-' + (c.loc.nom.trim().split(/\s+/)[0] || 'locataire').normalize('NFD').replace(/[^A-Za-z-]/g, '') + '.pdf';

  root.Contrat = { compute, check, build, fileName, eur, dmy, num };
})(typeof window !== 'undefined' ? window : globalThis);
