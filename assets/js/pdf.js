function generarPDF() {
    const elemento = document.querySelector('.cv-card');
    const variante = document.body.dataset.variante;
    const opciones = {
        margin:       5,
        filename:     'Curriculum_Cristian_Ginarte' + (variante ? '_' + variante : '') + '.pdf',
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
    };
    html2pdf().set(opciones).from(elemento).save();
}