var ANCHO_CV = { corta: 980, larga: 900 };

// Alto al que se estira una tarjeta para que, una vez escalada, ocupe la
// hoja entera. 287mm de alto util (A4 menos 2x5mm) por 980px de ancho de
// diseno sobre 200mm de ancho util dan 1406px. Se queda en 1390 para que un
// redondeo no lo empujase a una tercera pagina.
var ALTO_HOJA = 1390;

function esVersionCorta() {
    return !!document.querySelector('.side');
}

// La version corta se reparte en dos hojas. Se clona la tarjeta en vez de
// duplicar el HTML de la barra lateral a mano en los tres idiomas, asi que
// el contenido sigue teniendo una unica fuente.
function prepararPaginas() {
    if (!esVersionCorta()) return;
    if (document.querySelector('.paginas')) return;

    const tarjeta = document.querySelector('.cv-card');
    const main1 = tarjeta && tarjeta.querySelector('.main');
    if (!main1) return;

    const bloques = Array.prototype.slice.call(main1.querySelectorAll(':scope > .bloque'));
    // La hoja 1 se queda con perfil y experiencia. Todo lo demas (proyectos y
    // formacion) pasa a la hoja 2, que va a ancho completo. El corte se busca
    // por el titulo para no depender del idioma.
    //
    // Los proyectos no se reparten entre las dos hojas: la hoja 1 aguanta
    // gracias a la barra lateral, que ocupa toda su altura, mientras que la
    // hoja 2 se queda a pelo. Meterle proyectos a la hoja 1 solo desplaza el
    // hueco de una a otra.
    const iCorte = bloques.findIndex(function (b) {
        const h2 = b.querySelector('h2');
        return h2 && /proyecto|projet|project/i.test(h2.textContent);
    });
    if (iCorte < 1) return;

    const caja = document.createElement('div');
    caja.className = 'paginas';
    tarjeta.parentNode.insertBefore(caja, tarjeta);
    caja.appendChild(tarjeta);

    const hoja2 = tarjeta.cloneNode(true);
    hoja2.classList.add('cv-card--ancha');
    const lateral = hoja2.querySelector('.side');
    if (lateral) lateral.parentNode.removeChild(lateral);
    caja.appendChild(hoja2);

    const main2 = hoja2.querySelector('.main');
    Array.prototype.slice.call(main2.querySelectorAll(':scope > .bloque'))
        .forEach(function (b) { main2.removeChild(b); });

    // appendChild ya traslada el nodo de donde este, asi que no hace falta
    // quitarlo antes de su sitio.
    bloques.slice(iCorte).forEach(function (b) { main2.appendChild(b); });
}

function generarPDF() {
    const tarjeta = document.querySelector('.cv-card');
    const variante = document.body.dataset.variante;
    const corta = esVersionCorta();
    const ancho = corta ? ANCHO_CV.corta : ANCHO_CV.larga;

    const opciones = {
        margin:       5,
        filename:     'Curriculum_Cristian_Ginarte' + (variante ? '_' + variante : '') + '.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };

    // La corta son dos hojas explicitas: el salto entre ellas lo impone el
    // CSS. La completa se parte en varias y hay que evitar que un corte caiga
    // en medio de una tarjeta.
    opciones.pagebreak = corta
        ? { mode: ['css', 'legacy'] }
        : { mode: ['css', 'legacy'], avoid: ['.item', '.tl-item', '.educ-item', '.proyecto'] };

    // html2pdf escala el elemento ya renderizado al ancho util de la hoja, asi
    // que el alto final depende de la razon alto/ancho. Con una ventana de
    // navegador estrecha la tarjeta se estrecha, el texto envuelve mas y el
    // PDF se descuadra. Se inyecta una hoja de estilo temporal que fija el
    // ancho de diseno, devuelve el layout de escritorio y estira cada hoja
    // hasta llenar la pagina, para que el PDF sea siempre igual sin importar
    // el tamano de la ventana.
    const estilo = document.createElement('style');
    estilo.textContent =
        '.pdf-ancho-fijo .paginas {' +
            'width: ' + ancho + 'px !important;' +
            'max-width: ' + ancho + 'px !important;' +
            'gap: 0 !important;' +
        '}' +
        '.pdf-ancho-fijo .cv-card {' +
            'width: ' + ancho + 'px !important;' +
            'max-width: ' + ancho + 'px !important;' +
            'flex-direction: row !important;' +
            (corta ? 'min-height: ' + ALTO_HOJA + 'px !important;' : '') +
        '}' +
        (corta ?
            '.pdf-ancho-fijo .side {' +
                'width: 32% !important;' +
                'border-bottom: none !important;' +
                'border-right: 1px solid #7a9fdf !important;' +
            '}' +
            '.pdf-ancho-fijo .main {' +
                'width: 68% !important;' +
                'padding: 16px 30px !important;' +
            '}' +
            '.pdf-ancho-fijo .cv-card--ancha .main { width: 100% !important; }' +
            '.pdf-ancho-fijo .paginas > .cv-card + .cv-card {' +
                'break-before: page !important;' +
                'page-break-before: always !important;' +
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
        const objetivo = document.querySelector('.paginas') || tarjeta;
        const worker = html2pdf().set(opciones).from(objetivo);
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

if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', prepararPaginas);
} else {
    prepararPaginas();
}
