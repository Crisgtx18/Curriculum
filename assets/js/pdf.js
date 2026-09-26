function generarPDF() {
    const elemento = document.querySelector('.cv-card');
    const variante = document.body.dataset.variante;

    // La version corta tiene barra lateral; la completa no.
    // Se detecta por el DOM y no por data-variante porque ese atributo
    // no es consistente entre idiomas (resumido / pt / en).
    const esCorta = !!document.querySelector('.side');

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

    html2pdf().set(opciones).from(elemento).save();
}
