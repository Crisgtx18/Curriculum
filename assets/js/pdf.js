var ANCHO_CV = { corta: 980, larga: 900 };

function generarPDF() {
    const tarjeta = document.querySelector('.cv-card');
    const variante = document.body.dataset.variante;

    // La version corta tiene barra lateral; la completa no.
    // Se detecta por el DOM y no por data-variante porque ese atributo
    // no es consistente entre idiomas (resumido / pt / en).
    const esCorta = !!document.querySelector('.side');
    const ancho = esCorta ? ANCHO_CV.corta : ANCHO_CV.larga;

    const opciones = {
        margin:       5,
        filename:     'Curriculum_Cristian_Ginarte' + (variante ? '_' + variante : '') + '.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // La corta cabe en una sola pagina. La completa se parte en varias,
    // y hay que evitar que un corte caiga en medio de una tarjeta.
    opciones.pagebreak = esCorta
        ? { mode: ['css', 'legacy'] }
        : { mode: ['css', 'legacy'], avoid: ['.item', '.tl-item', '.educ-item', '.proyecto'] };

    // html2pdf escala la tarjeta ya renderizada al ancho util de la hoja,
    // asi que el alto final depende de la razon alto/ancho. Con una ventana
    // de navegador estrecha la tarjeta se estrecha, el texto envuelve mas y
    // el PDF se va a 2 o mas paginas. Por debajo de 820px el breakpoint
    // responsive ademas la parte en dos columnas.
    // Se inyecta una hoja de estilo temporal que fija el ancho de diseno y
    // devuelve el layout de escritorio, para que el PDF sea siempre igual
    // sin importar el tamano de la ventana.
    const estilo = document.createElement('style');
    estilo.textContent =
        '.pdf-ancho-fijo .cv-card {' +
            'width: ' + ancho + 'px !important;' +
            'max-width: ' + ancho + 'px !important;' +
            'flex-direction: row !important;' +
        '}' +
        (esCorta ?
            '.pdf-ancho-fijo .side {' +
                'width: 32% !important;' +
                'border-bottom: none !important;' +
                'border-right: 1px solid #7a9fdf !important;' +
            '}' +
            '.pdf-ancho-fijo .main {' +
                'width: 68% !important;' +
                'padding: 16px 30px !important;' +
            '}'
        :
            '.pdf-ancho-fijo .header, .pdf-ancho-fijo .main {' +
                'flex-direction: row !important;' +
            '}' +
            '.pdf-ancho-fijo .main { text-align: left !important; }' +
            '.pdf-ancho-fijo .col-izq {' +
                'width: 40% !important;' +
                'border-right: 1px solid #e6eaf2 !important;' +
                'padding-right: 26px !important;' +
            '}' +
            '.pdf-ancho-fijo .col-der { width: 60% !important; }'
        );
    document.head.appendChild(estilo);
    document.body.classList.add('pdf-ancho-fijo');

    function restaurar() {
        document.body.classList.remove('pdf-ancho-fijo');
        if (estilo.parentNode) estilo.parentNode.removeChild(estilo);
    }

    try {
        const worker = html2pdf().set(opciones).from(tarjeta);
        const promesa = worker.save();
        if (promesa && typeof promesa.then === 'function') {
            promesa.then(restaurar, restaurar);
        }
        setTimeout(restaurar, 15000);
    } catch (error) {
        restaurar();
        throw error;
    }
}
