import { PDFDocument, StandardFonts, rgb } from 'pdf-lib';
import fs from 'fs';
import path from 'path';

// Sanitize characters to WinAnsi-compatible set for pdf-lib StandardFonts
function safeText(str) {
  return String(str || '')
    .replace(/[\u2018\u2019]/g, "'")
    .replace(/[\u201C\u201D]/g, '"')
    .replace(/[\u2013\u2014]/g, '-')
    .replace(/\u2026/g, '...')
    .replace(/\u2022/g, '*')
    .replace(/[^\x20-\x7E\xA0-\xFF]/g, '');
}

export async function generateApostilaPdf(outputPath) {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontSerif = await pdfDoc.embedFont(StandardFonts.TimesRomanItalic);
  const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold);

  const width = 595.28; // A4 width
  const height = 841.89; // A4 height

  // ---------------- PAGE 1 ----------------
  const page1 = pdfDoc.addPage([width, height]);

  // Top academic header banner
  page1.drawRectangle({
    x: 0,
    y: height - 95,
    width,
    height: 95,
    color: rgb(0.14, 0.16, 0.32),
  });

  page1.drawText(safeText('CADERNO DE ESTUDOS AVANCADO  |  MODULO 01'), {
    x: 45,
    y: height - 38,
    size: 9,
    font: fontMono,
    color: rgb(0.75, 0.8, 0.98),
  });

  page1.drawText(safeText('Fisiologia Humana, Bioenergetica & Neurociencia da Aprendizagem'), {
    x: 45,
    y: height - 62,
    size: 15,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page1.drawText(safeText('Material de revisao teorica com conceitos-chave, esquemas e pontos de prova.'), {
    x: 45,
    y: height - 80,
    size: 10,
    font: fontSerif,
    color: rgb(0.85, 0.88, 0.96),
  });

  let y = height - 130;

  // Section 1
  page1.drawText(safeText('1. Metabolismo Energetico e Producao de ATP'), {
    x: 45,
    y,
    size: 13,
    font: fontBold,
    color: rgb(0.12, 0.14, 0.28),
  });
  y -= 20;

  const p1Lines = [
    'A adenosina trifosfato (ATP) atua como a moeda energetica universal das celulas vivas.',
    'A sintese de ATP ocorre principalmente por tres vias metabolicas integradas:',
    '  1) Glicolise anaerobia no citosol (saldo liquido de 2 ATP e 2 NADH por glicose);',
    '  2) Ciclo de Krebs (Ciclo do Acido Citrico) na matriz mitocondrial;',
    '  3) Fosforilacao Oxidativa acoplada a cadeia transportadora de eletrons nas cristas',
    '     mitocondriais, responsavel por cerca de 85% a 90% de todo o ATP celular.',
  ];

  for (const line of p1Lines) {
    page1.drawText(safeText(line), {
      x: 45,
      y,
      size: 10.5,
      font: fontRegular,
      color: rgb(0.18, 0.18, 0.2),
    });
    y -= 16;
  }

  y -= 10;
  // Callout Box
  page1.drawRectangle({
    x: 45,
    y: y - 78,
    width: width - 90,
    height: 86,
    color: rgb(0.96, 0.97, 1.0),
    borderColor: rgb(0.28, 0.32, 0.75),
    borderWidth: 1.2,
  });

  page1.drawText(safeText('ATENCAO PARA A PROVA: Inibidores vs. Desacopladores Mitocondriais'), {
    x: 58,
    y: y - 16,
    size: 10.5,
    font: fontBold,
    color: rgb(0.18, 0.22, 0.65),
  });

  const boxLines = [
    '- Cianeto e Monoxido de Carbono bloqueiam o Complexo IV (Citocromo c oxidase),',
    '  interrompendo tanto o transporte de eletrons quanto a sintese de ATP.',
    '- Desacopladores (como 2,4-DNP e a proteina UCP1/Termogenina do tecido adiposo marrom)',
    '  dissipam o gradiente de protons (H+) gerando CALOR sem bloquear o consumo de O2.',
  ];
  let by = y - 34;
  for (const bl of boxLines) {
    page1.drawText(safeText(bl), {
      x: 58,
      y: by,
      size: 9.8,
      font: fontRegular,
      color: rgb(0.15, 0.16, 0.22),
    });
    by -= 14;
  }

  y -= 112;

  // Section 2
  page1.drawText(safeText('2. Quadro Comparativo das Etapas da Respiracao Celular'), {
    x: 45,
    y,
    size: 13,
    font: fontBold,
    color: rgb(0.12, 0.14, 0.28),
  });
  y -= 22;

  // Draw Table Header
  page1.drawRectangle({
    x: 45,
    y: y - 18,
    width: width - 90,
    height: 24,
    color: rgb(0.2, 0.23, 0.4),
  });
  page1.drawText(safeText('Etapa Metabolica'), { x: 55, y: y - 10, size: 9.5, font: fontBold, color: rgb(1, 1, 1) });
  page1.drawText(safeText('Local Celular'), { x: 205, y: y - 10, size: 9.5, font: fontBold, color: rgb(1, 1, 1) });
  page1.drawText(safeText('Principais Produtos'), { x: 350, y: y - 10, size: 9.5, font: fontBold, color: rgb(1, 1, 1) });

  const rows = [
    ['Glicolise', 'Citosol (Hialoplasma)', '2 Piruvato, 2 ATP, 2 NADH'],
    ['Oxidacao do Piruvato', 'Matriz Mitocondrial', '2 Acetil-CoA, 2 CO2, 2 NADH'],
    ['Ciclo de Krebs', 'Matriz Mitocondrial', '4 CO2, 2 ATP (GTP), 6 NADH, 2 FADH2'],
    ['Cadeia Respiratoria', 'Cristas Mitocondriais', '26 a 28 ATP + H2O (O2 = aceptor final)'],
  ];

  let ty = y - 42;
  rows.forEach((r, idx) => {
    page1.drawRectangle({
      x: 45,
      y: ty,
      width: width - 90,
      height: 24,
      color: idx % 2 === 0 ? rgb(0.98, 0.98, 0.99) : rgb(0.93, 0.94, 0.97),
      borderColor: rgb(0.84, 0.86, 0.9),
      borderWidth: 0.5,
    });
    page1.drawText(safeText(r[0]), { x: 55, y: ty + 7, size: 9.5, font: fontBold, color: rgb(0.15, 0.15, 0.2) });
    page1.drawText(safeText(r[1]), { x: 205, y: ty + 7, size: 9.5, font: fontRegular, color: rgb(0.2, 0.2, 0.25) });
    page1.drawText(safeText(r[2]), { x: 350, y: ty + 7, size: 9.5, font: fontRegular, color: rgb(0.2, 0.2, 0.25) });
    ty -= 24;
  });

  y = ty - 26;

  // Section 3
  page1.drawText(safeText('3. Neurofisiologia: Potencial de Acao e Transmissao Sinaptica'), {
    x: 45,
    y,
    size: 13,
    font: fontBold,
    color: rgb(0.12, 0.14, 0.28),
  });
  y -= 20;

  const neuroLines = [
    'Em repouso, a membrana neuronal mantem potencial eletrico proximo a -70 mV gracas a',
    'bomba de Sodio-Potassio (Na+/K+ ATPase), que bombeia 3 Na+ para o meio extracelular',
    'e 2 K+ para o meio intracelular contra seus gradientes eletroquimicos.',
    '',
    'Fases do Potencial de Acao (Lei do Tudo ou Nada):',
    '  * Despolarizacao: Abertura rapida dos canais de Na+ dependentes de voltagem (influxo de Na+).',
    '  * Repolarizacao: Inativacao dos canais de Na+ e abertura dos canais de K+ (efluxo de K+).',
    '  * Hiperpolarizacao: Fechamento lento dos canais de K+, tornando o interior ainda mais negativo.',
    '',
    'A bainha de mielina (oligodendrocitos no SNC e celulas de Schwann no SNP) permite a',
    'conducao saltatoria nos Nodulos de Ranvier, aumentando drasticamente a velocidade do impulso.',
  ];

  for (const line of neuroLines) {
    if (line === '') {
      y -= 8;
      continue;
    }
    page1.drawText(safeText(line), {
      x: 45,
      y,
      size: 10.2,
      font: fontRegular,
      color: rgb(0.18, 0.18, 0.2),
    });
    y -= 15.5;
  }

  page1.drawText(safeText('Pagina 1 de 3  |  Papiro Estudio de Leitura'), {
    x: 45,
    y: 28,
    size: 8.5,
    font: fontMono,
    color: rgb(0.5, 0.5, 0.55),
  });

  // ---------------- PAGE 2 ----------------
  const page2 = pdfDoc.addPage([width, height]);
  page2.drawRectangle({
    x: 0,
    y: height - 55,
    width,
    height: 55,
    color: rgb(0.14, 0.16, 0.32),
  });
  page2.drawText(safeText('APOSTILA DE REVISAO  |  MODULO 01  -  HOMEOSTASE E SISTEMA ENDOCRINO'), {
    x: 45,
    y: height - 33,
    size: 10.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  let y2 = height - 90;
  page2.drawText(safeText('4. Regulacao Glicemica: Insulina vs. Glucagon'), {
    x: 45,
    y: y2,
    size: 13,
    font: fontBold,
    color: rgb(0.12, 0.14, 0.28),
  });
  y2 -= 20;

  const p2Lines = [
    'O pancreas endocrino (Ilhotas de Langerhans) coordena a homeostase da glicose sanguinea:',
    '',
    'A) INSULINA (Celulas Beta Pancreaticas - Estado Pos-Prandial / Hiperglicemia):',
    '   - Estimula a translocacao de transportadores GLUT-4 no musculo esqueletico e tecido adiposo;',
    '   - Ativa a glicogenese hepatica e muscular (armazenamento de glicogenio);',
    '   - Estimula a lipogenese e sintese proteica (hormonio anabolico).',
    '',
    'B) GLUCAGON (Celulas Alfa Pancreaticas - Jejum / Hipoglicemia):',
    '   - Atua principalmente nos hepatocitos via receptor acoplado a proteina G (AMPc / PKA);',
    '   - Estimula a glicogenolise (quebra de glicogenio) e a gliconeogenese;',
    '   - Promove mobilizacao de acidos graxos para manter a oferta energetica ao organismo.',
    '',
    '5. Eixo Hipotalamo-Hipofise-Adrenal e Resposta ao Estresse',
    'Durante situacoes de estresse agudo ou cronico, dois sistemas atuam em sinergia:',
    '  1. Resposta Rapida (Segundos): Sistema Nervoso Simpatico -> Medula Adrenal libera',
    '     Adrenalina e Noradrenalina (taquicardia, broncodilatacao, glicogenolise).',
    '  2. Resposta Sustentada (Minutos a Horas): Hipotalamo secreta CRH -> Adeno-hipofise',
    '     secreta ACTH -> Cortex da Adrenal secreta Cortisol (gliconeogenese e modulacao imune).',
  ];

  for (const line of p2Lines) {
    if (line === '') {
      y2 -= 8;
      continue;
    }
    const isHeading = line.startsWith('5.') || line.startsWith('A)') || line.startsWith('B)');
    page2.drawText(safeText(line), {
      x: 45,
      y: y2,
      size: isHeading ? 11 : 10.3,
      font: isHeading ? fontBold : fontRegular,
      color: isHeading ? rgb(0.14, 0.18, 0.42) : rgb(0.18, 0.18, 0.2),
    });
    y2 -= 16;
  }

  y2 -= 15;
  // Summary Formula Box
  page2.drawRectangle({
    x: 45,
    y: y2 - 90,
    width: width - 90,
    height: 95,
    color: rgb(0.95, 0.99, 0.96),
    borderColor: rgb(0.16, 0.58, 0.35),
    borderWidth: 1.2,
  });

  page2.drawText(safeText('EQUACAO DE HENDERSON-HASSELBALCH (TAMPAO BICARBONATO SANGUINEO)'), {
    x: 58,
    y: y2 - 18,
    size: 10,
    font: fontBold,
    color: rgb(0.1, 0.42, 0.24),
  });
  page2.drawText(safeText('pH = 6,1 + log ( [HCO3-] / (0,03 x PaCO2) )    -->   pH arterial normal: 7,35 a 7,45'), {
    x: 58,
    y: y2 - 38,
    size: 10.5,
    font: fontMono,
    color: rgb(0.1, 0.28, 0.18),
  });
  page2.drawText(safeText('* Acidose Respiratoria: hipoventilacao -> retencao de CO2 -> queda do pH sanguineo.'), {
    x: 58,
    y: y2 - 58,
    size: 9.8,
    font: fontRegular,
    color: rgb(0.15, 0.2, 0.18),
  });
  page2.drawText(safeText('* Alcalose Respiratoria: hiperventilacao (ex: ansiedade ou altitude) -> queda da PaCO2.'), {
    x: 58,
    y: y2 - 74,
    size: 9.8,
    font: fontRegular,
    color: rgb(0.15, 0.2, 0.18),
  });

  // Blank study space on page 2 for student notes
  y2 -= 125;
  page2.drawRectangle({
    x: 45,
    y: 65,
    width: width - 90,
    height: y2 - 65,
    color: rgb(0.99, 0.99, 0.98),
    borderColor: rgb(0.82, 0.82, 0.85),
    borderWidth: 0.8,
  });
  page2.drawText(safeText('ESPACO PARA ESQUEMAS, MAPA MENTAL E ANOTACOES MANUSCRITAS:'), {
    x: 58,
    y: y2 - 18,
    size: 9,
    font: fontMono,
    color: rgb(0.45, 0.45, 0.5),
  });

  page2.drawText(safeText('Pagina 2 de 3  |  Papiro Estudio de Leitura'), {
    x: 45,
    y: 28,
    size: 8.5,
    font: fontMono,
    color: rgb(0.5, 0.5, 0.55),
  });

  // ---------------- PAGE 3 ----------------
  const page3 = pdfDoc.addPage([width, height]);
  page3.drawRectangle({
    x: 0,
    y: height - 55,
    width,
    height: 55,
    color: rgb(0.14, 0.16, 0.32),
  });
  page3.drawText(safeText('APOSTILA DE REVISAO  |  MODULO 01  -  CHECKLIST E QUESTOES DE FIXACAO'), {
    x: 45,
    y: height - 33,
    size: 10.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  let y3 = height - 90;
  page3.drawText(safeText('6. Exercicios Rapidos de Fixacao (Use o Marca-texto ou Caneta para Resolver)'), {
    x: 45,
    y: y3,
    size: 13,
    font: fontBold,
    color: rgb(0.12, 0.14, 0.28),
  });
  y3 -= 26;

  const qLines = [
    'QUESTAO DE FIXACAO 01:',
    'Um pesquisador adicionou uma substancia desacopladora da fosforilacao oxidativa a uma',
    'suspensao de mitocondrias isoladas na presenca de oxigenio e substrato energetico.',
    'Assinale o efeito imediato observado:',
    '  (A) Reducao abrupta do consumo de O2 e aumento da producao de ATP.',
    '  (B) Aumento do consumo de O2, queda na sintese de ATP e maior liberacao de calor.',
    '  (C) Parada completa do Ciclo de Krebs por excesso de ATP intramitocondrial.',
    '  (D) Inibicao direta da enzima citocromo c oxidase na membrana externa.',
    '',
    'QUESTAO DE FIXACAO 02:',
    'Durante a fase de despolarizacao rapida do potencial de acao em um axonio gigante,',
    'qual evento ionico predomina na membrana plasmatica?',
    '  (A) Saida massiva de ions potassio (K+) a favor do gradiente quimico.',
    '  (B) Entrada rapida de ions cloreto (Cl-) mediada por neurotransmissores.',
    '  (C) Influxo rapido de ions sodio (Na+) atraves de canais dependentes de voltagem.',
    '  (D) Bombeamento ativo de 3 K+ para fora da celula com gasto de ATP.',
    '',
    'GABARITO COMENTADO PARA AUTOAVALIACAO:',
    '  * Fixacao 01 -> Alternativa (B): Desacopladores dissipam o gradiente protonico como calor.',
    '  * Fixacao 02 -> Alternativa (C): O limiar abre canais de Na+ voltagem-dependentes.',
  ];

  for (const line of qLines) {
    if (line === '') {
      y3 -= 10;
      continue;
    }
    const isHeader = line.startsWith('QUESTAO') || line.startsWith('GABARITO');
    page3.drawText(safeText(line), {
      x: 45,
      y: y3,
      size: isHeader ? 11 : 10.2,
      font: isHeader ? fontBold : fontRegular,
      color: isHeader ? rgb(0.16, 0.2, 0.5) : rgb(0.18, 0.18, 0.2),
    });
    y3 -= 16;
  }

  page3.drawText(safeText('Pagina 3 de 3  |  Papiro Estudio de Leitura'), {
    x: 45,
    y: 28,
    size: 8.5,
    font: fontMono,
    color: rgb(0.5, 0.5, 0.55),
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

export async function generateProvaPdf(outputPath) {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.CourierBold);

  const width = 595.28;
  const height = 841.89;

  // ---------------- PAGE 1 ----------------
  const page1 = pdfDoc.addPage([width, height]);

  page1.drawRectangle({
    x: 0,
    y: height - 90,
    width,
    height: 90,
    color: rgb(0.1, 0.12, 0.16),
  });

  page1.drawText(safeText('SIMULADO OFICIAL  |  CADERNO DE PROVA  -  CIENCIAS DA NATUREZA & LOGICA'), {
    x: 40,
    y: height - 35,
    size: 10,
    font: fontMono,
    color: rgb(0.95, 0.78, 0.25),
  });

  page1.drawText(safeText('Prova Objetiva Comentada - Treino de Resolucao Ativa'), {
    x: 40,
    y: height - 58,
    size: 15,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  page1.drawText(safeText('Dica: Grife os comandos das questoes com Marca-texto, faca contas com a Caneta e cole Post-its!'), {
    x: 40,
    y: height - 76,
    size: 9.5,
    font: fontRegular,
    color: rgb(0.8, 0.82, 0.88),
  });

  let y = height - 122;

  const questionsP1 = [
    {
      num: 'QUESTAO 01  (Termodinamica & Potencia Eletrica)',
      body: [
        'Um chuveiro eletrico residencial opera sob tensao nominal de 220 V e consome uma potencia',
        'de 4.400 W na posicao "Inverno". Considerando que toda a energia eletrica dissipada pelo',
        'resistor seja integralmente utilizada para aquecer a agua e que o disjuntor do circuito',
        'deve suportar pelo menos 20% acima da corrente nominal, qual e a corrente eletrica',
        'que atravessa o chuveiro em funcionamento?',
      ],
      options: [
        '(A) 10 A',
        '(B) 15 A',
        '(C) 20 A',
        '(D) 24 A',
        '(E) 40 A',
      ],
    },
    {
      num: 'QUESTAO 02  (Estequiometria & Rendimento de Reacao)',
      body: [
        'Na sintese industrial da amonia pelo processo Haber-Bosch (N2 + 3 H2 -> 2 NH3),',
        'foram colocados para reagir 28 g de gas nitrogenio (Massa Molar N2 = 28 g/mol) com',
        'excesso de gas hidrogenio. Sabendo que o rendimento percentual do reator sob aquelas',
        'condicoes de pressao e temperatura foi de 80%, qual a massa de amonia (MM = 17 g/mol)',
        'efetivamente produzida ao final do processo?',
      ],
      options: [
        '(A) 13,6 g',
        '(B) 17,0 g',
        '(C) 27,2 g',
        '(D) 34,0 g',
        '(E) 42,5 g',
      ],
    },
    {
      num: 'QUESTAO 03  (Cinematica & Frenagem de Emergencia)',
      body: [
        'Um veiculo trafega em uma rodovia retilinea a velocidade constante de 72 km/h (20 m/s).',
        'Ao avistar um obstaculo, o motorista aciona os freios imprimindo uma desaceleracao',
        'constante de modulo 5 m/s2 ate parar completamente. Desprezando o tempo de reacao,',
        'qual a distancia percorrida pelo automovel durante a frenagem (Use: v2 = v02 + 2.a.d)?',
      ],
      options: [
        '(A) 20 metros',
        '(B) 35 metros',
        '(C) 40 metros',
        '(D) 50 metros',
        '(E) 80 metros',
      ],
    },
  ];

  for (const q of questionsP1) {
    page1.drawRectangle({
      x: 40,
      y: y - 5,
      width: width - 80,
      height: 22,
      color: rgb(0.92, 0.94, 0.98),
    });
    page1.drawText(safeText(q.num), {
      x: 48,
      y: y + 2,
      size: 10.5,
      font: fontBold,
      color: rgb(0.12, 0.16, 0.38),
    });
    y -= 24;

    for (const line of q.body) {
      page1.drawText(safeText(line), {
        x: 45,
        y,
        size: 10,
        font: fontRegular,
        color: rgb(0.15, 0.15, 0.18),
      });
      y -= 14.5;
    }
    y -= 4;

    // Two columns: options on left, calculation scratch box on right
    const optStartY = y;
    for (const opt of q.options) {
      page1.drawText(safeText(opt), {
        x: 52,
        y,
        size: 10,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.25),
      });
      y -= 15;
    }

    // Scratch box on the right side for each question
    page1.drawRectangle({
      x: 250,
      y: y + 10,
      width: width - 290,
      height: optStartY - y + 2,
      color: rgb(0.99, 0.99, 0.97),
      borderColor: rgb(0.82, 0.82, 0.86),
      borderWidth: 0.7,
    });
    page1.drawText(safeText('Rascunho / Calculo:'), {
      x: 258,
      y: optStartY - 2,
      size: 8,
      font: fontMono,
      color: rgb(0.55, 0.55, 0.6),
    });

    y -= 18;
  }

  page1.drawText(safeText('Pagina 1 de 2  |  Caderno de Prova - Papiro'), {
    x: 40,
    y: 25,
    size: 8.5,
    font: fontMono,
    color: rgb(0.5, 0.5, 0.55),
  });

  // ---------------- PAGE 2 ----------------
  const page2 = pdfDoc.addPage([width, height]);
  page2.drawRectangle({
    x: 0,
    y: height - 52,
    width,
    height: 52,
    color: rgb(0.1, 0.12, 0.16),
  });
  page2.drawText(safeText('SIMULADO OFICIAL  |  CONTINUACAO & GABARITO OFICIAL'), {
    x: 40,
    y: height - 32,
    size: 10.5,
    font: fontBold,
    color: rgb(1, 1, 1),
  });

  let y2 = height - 85;
  const questionsP2 = [
    {
      num: 'QUESTAO 04  (Raciocinio Logico & Probabilidade)',
      body: [
        'Em uma urna ha 5 bolas vermelhas, 3 bolas azuis e 2 bolas verdes, todas indistinguiveis',
        'ao tato. Retirando-se duas bolas sucessivamente e SEM reposicao, qual a probabilidade',
        'de ambas as bolas sorteadas serem vermelhas?',
      ],
      options: [
        '(A) 1/4  (25,0%)',
        '(B) 2/9  (22,2%)',
        '(C) 1/5  (20,0%)',
        '(D) 5/18 (27,7%)',
        '(E) 1/2  (50,0%)',
      ],
    },
    {
      num: 'QUESTAO 05  (Genetica Mendeliana & Genealogia)',
      body: [
        'Um casal fenotipicamente normal para o albinismo (condicao autossomica recessiva "aa")',
        'ja possui um primeiro filho albino. Qual a probabilidade de o proximo filho desse mesmo',
        'casal ser uma crianca fenotipicamente normal E heterozigota (portadora do alelo recessivo)?',
      ],
      options: [
        '(A) 1/4  (25%)',
        '(B) 1/2  (50%)',
        '(C) 2/3  (66,7%)',
        '(D) 3/4  (75%)',
        '(E) 1/8  (12,5%)',
      ],
    },
  ];

  for (const q of questionsP2) {
    page2.drawRectangle({
      x: 40,
      y: y2 - 5,
      width: width - 80,
      height: 22,
      color: rgb(0.92, 0.94, 0.98),
    });
    page2.drawText(safeText(q.num), {
      x: 48,
      y: y2 + 2,
      size: 10.5,
      font: fontBold,
      color: rgb(0.12, 0.16, 0.38),
    });
    y2 -= 24;

    for (const line of q.body) {
      page2.drawText(safeText(line), {
        x: 45,
        y: y2,
        size: 10,
        font: fontRegular,
        color: rgb(0.15, 0.15, 0.18),
      });
      y2 -= 14.5;
    }
    y2 -= 4;

    const optStartY = y2;
    for (const opt of q.options) {
      page2.drawText(safeText(opt), {
        x: 52,
        y: y2,
        size: 10,
        font: fontBold,
        color: rgb(0.2, 0.2, 0.25),
      });
      y2 -= 15;
    }

    page2.drawRectangle({
      x: 250,
      y: y2 + 10,
      width: width - 290,
      height: optStartY - y2 + 2,
      color: rgb(0.99, 0.99, 0.97),
      borderColor: rgb(0.82, 0.82, 0.86),
      borderWidth: 0.7,
    });
    page2.drawText(safeText('Rascunho / Calculo:'), {
      x: 258,
      y: optStartY - 2,
      size: 8,
      font: fontMono,
      color: rgb(0.55, 0.55, 0.6),
    });

    y2 -= 24;
  }

  // Answer Key Box at bottom of Page 2
  page2.drawRectangle({
    x: 40,
    y: 75,
    width: width - 80,
    height: 155,
    color: rgb(0.96, 0.97, 0.99),
    borderColor: rgb(0.25, 0.3, 0.55),
    borderWidth: 1,
  });

  page2.drawText(safeText('RESOLUCAO RESUMIDA & GABARITO OFICIAL DO SIMULADO:'), {
    x: 52,
    y: 208,
    size: 10.5,
    font: fontBold,
    color: rgb(0.15, 0.2, 0.48),
  });

  const gabaritoLines = [
    'Q01 -> (C) 20 A   |  Formula: P = U . i  =>  4400 = 220 . i  =>  i = 20 A.',
    'Q02 -> (C) 27,2 g |  1 mol N2 (28g) forma 2 mols NH3 (34g). Com 80% de rendimento: 34 x 0,8 = 27,2 g.',
    'Q03 -> (C) 40 m   |  Torricelli: 0 = 20^2 + 2.(-5).d  =>  10.d = 400  =>  d = 40 metros.',
    'Q04 -> (B) 2/9    |  P = (5/10) x (4/9) = 20/90 = 2/9.',
    'Q05 -> (B) 1/2    |  Pais sao Aa x Aa. Cruzamento: 1/4 AA, 2/4 Aa, 1/4 aa. Normal E heterozigoto (Aa) = 2/4 = 1/2.',
  ];

  let gy = 186;
  for (const gl of gabaritoLines) {
    page2.drawText(safeText(gl), {
      x: 52,
      y: gy,
      size: 9.2,
      font: fontRegular,
      color: rgb(0.18, 0.2, 0.25),
    });
    gy -= 18;
  }

  page2.drawText(safeText('Pagina 2 de 2  |  Caderno de Prova - Papiro'), {
    x: 40,
    y: 25,
    size: 8.5,
    font: fontMono,
    color: rgb(0.5, 0.5, 0.55),
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
}

export async function generatePdfFromTextFile(title, rawText, outputPath) {
  const pdfDoc = await PDFDocument.create();
  const fontRegular = await pdfDoc.embedFont(StandardFonts.Helvetica);
  const fontBold = await pdfDoc.embedFont(StandardFonts.HelveticaBold);
  const fontMono = await pdfDoc.embedFont(StandardFonts.Courier);

  const width = 595.28;
  const height = 841.89;
  const margin = 50;
  const maxCharsPerLine = 82;

  const rawLines = String(rawText || '').split(/\r?\n/);
  const wrappedLines = [];

  for (const rLine of rawLines) {
    const clean = safeText(rLine);
    if (clean.length <= maxCharsPerLine) {
      wrappedLines.push(clean);
    } else {
      const words = clean.split(' ');
      let current = '';
      for (const w of words) {
        if ((current + ' ' + w).trim().length > maxCharsPerLine) {
          wrappedLines.push(current.trim());
          current = w;
        } else {
          current = (current + ' ' + w).trim();
        }
      }
      if (current.trim()) wrappedLines.push(current.trim());
    }
  }

  let page = pdfDoc.addPage([width, height]);
  let pageCount = 1;
  let y = height - 60;

  page.drawText(safeText(title), {
    x: margin,
    y,
    size: 14,
    font: fontBold,
    color: rgb(0.14, 0.16, 0.32),
  });
  y -= 28;

  for (const line of wrappedLines) {
    if (y < 60) {
      page.drawText(safeText(`Pagina ${pageCount}`), {
        x: margin,
        y: 28,
        size: 8.5,
        font: fontMono,
        color: rgb(0.5, 0.5, 0.55),
      });
      page = pdfDoc.addPage([width, height]);
      pageCount++;
      y = height - 55;
    }

    const isTitle = line.startsWith('#');
    page.drawText(line.replace(/^#+\s*/, ''), {
      x: margin,
      y,
      size: isTitle ? 12 : 10.5,
      font: isTitle ? fontBold : fontRegular,
      color: isTitle ? rgb(0.14, 0.16, 0.35) : rgb(0.18, 0.18, 0.2),
    });
    y -= isTitle ? 20 : 15;
  }

  page.drawText(safeText(`Pagina ${pageCount}`), {
    x: margin,
    y: 28,
    size: 8.5,
    font: fontMono,
    color: rgb(0.5, 0.5, 0.55),
  });

  const pdfBytes = await pdfDoc.save();
  fs.writeFileSync(outputPath, pdfBytes);
  return pageCount;
}
