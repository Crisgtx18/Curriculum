/* ==========================================================================
   pdf.js — Arma el currículum hoja por hoja y lo descarga como PDF.

   La idea es no dejarle el corte a la librería. Primero se reparte el
   currículum en cajas con la medida exacta de una hoja de A4 y se mide, con
   el propio navegador, si cada trozo entra; solo cuando todo está colocado se
   dibuja una imagen por caja y se pega una por página en el PDF. Como el corte
   lo ponemos nosotros, el número de páginas no depende del ancho de la
   ventana ni del navegador, y ninguna tarjeta, proyecto o experiencia queda
   partido por la mitad.

   Las piezas son:

     · el escenario, donde se arman las cajas y se mide lo que cabe
     · el PDF: una imagen por caja más una capa de texto invisible, para que el
       currículum se pueda buscar y copiar y no solo mirar
   ========================================================================== */

(function () {
    'use strict';

    /* ======================================================================
       1. Medidas
       ====================================================================== */

    var A4 = { ancho: 210, alto: 297 };        // mm
    var MARGEN = 8;                            // mm
    var CAJA = {                               // zona útil de la hoja
        ancho: A4.ancho - 2 * MARGEN,          // 194 mm
        alto: A4.alto - 2 * MARGEN             // 281 mm
    };

    // Ancho de diseño de cada plantilla, en px de pantalla: los mismos que se
    // ven en la web, para que el PDF salga con la maquetación de siempre. El
    // alto de la hoja sale de la proporción de la caja (194 x 281 mm); con
    // floor no se pasa nunca de los 281 mm, ni por un redondeo, que es lo que
    // abriría una hoja en blanco al final.
    var DISENO = { lateral: 980, vertical: 900 };
    function diseno() {
        var ancho = esLateral() ? DISENO.lateral : DISENO.vertical;
        return { ancho: ancho, alto: Math.floor(ancho * CAJA.alto / CAJA.ancho) };
    }

    var ESCALA = 2;        // 2x sobre el ancho de diseño = 256 ppp en el papel
    var TEXTO = true;      // capa de texto invisible sobre la imagen
    var TOLERANCIA = 1;    // px de holgura al medir si un bloque cabe

    function esLateral() {
        return !!document.querySelector('.cv-card .side');
    }

    /* ======================================================================
       2. Utilidades
       ====================================================================== */

    function todos(selector, raiz) {
        return Array.prototype.slice.call((raiz || document).querySelectorAll(selector));
    }

    function crear(tag, clase) {
        var el = document.createElement(tag);
        if (clase) el.className = clase;
        return el;
    }

    // ¿Se ve este nodo? Lo que está oculto no se dibuja ni se mide.
    function visible(nodo) {
        for (var el = nodo; el && el.nodeType === 1; el = el.parentElement) {
            var cs = getComputedStyle(el);
            if (cs.display === 'none' || cs.visibility === 'hidden') return false;
        }
        return true;
    }

    // ¿Cabe el contenido en la columna? scrollHeight da la altura del contenido
    // aunque desborde, y clientHeight la altura buena.
    function cabe(columna) {
        return columna.scrollHeight <= columna.clientHeight + TOLERANCIA;
    }

    /* ======================================================================
       3. Contenido
       ====================================================================== */

    // Título de un bloque, que es lo que se repite al partir una sección larga
    // entre varias columnas.
    function tituloDe(bloque) {
        var h = bloque.querySelector('h2, h3');
        return h ? h.textContent.trim() : '';
    }

    // Unidad: un trozo de currículum que se coloca entero en una columna si
    // cabe. Si trae `piezas`, se monta dentro de una copia vacía de
    // `envoltorio` y con el título repetido: es lo que permite partir una
    // sección larga (los proyectos, las habilidades) entre varias columnas.
    function unidad(envoltorio, piezas, titulo, proyectos) {
        return {
            envoltorio: envoltorio,
            piezas: piezas || null,
            titulo: titulo || '',
            proyectos: !!proyectos
        };
    }

    function unidadesLateral() {
        var main = document.querySelector('.cv-card .main');
        if (!main) return [];
        return todos(':scope > .bloque', main).map(function (b) {
            return unidad(b, null, '');
        });
    }

    function unidadesVertical() {
        var unas = [];
        todos('.col-izq > .seccion, .col-der > .seccion').forEach(function (seccion) {
            var titulo = tituloDe(seccion);

            // Los proyectos y las habilidades se parten en piezas sueltas: son
            // listas largas y meterlas enteras dejaría huecos enormes al final
            // de las columnas.
            var proyectos = todos(':scope > .proyecto', seccion);
            if (proyectos.length) {
                proyectos.forEach(function (p) { unas.push(unidad(seccion, [p], titulo, true)); });
                todos(':scope > .nota-proyectos', seccion).forEach(function (n) {
                    unas.push(unidad(seccion, [n], titulo, true));
                });
                return;
            }

            var grupos = todos(':scope > .skill-group', seccion);
            if (grupos.length) {
                grupos.forEach(function (g) { unas.push(unidad(seccion, [g], titulo)); });
                return;
            }

            unas.push(unidad(seccion, null, ''));
        });
        return unas;
    }

    /* ======================================================================
       4. Plan de hojas
       ====================================================================== */

    // Cada grupo es una tanda de páginas con la misma forma. El primero lleva el
    // cromo (barra lateral o cabecera) y, si el contenido no cabe, se abren
    // más páginas de esa misma forma.
    //
    // En la versión corta todo el contenido va en el mismo grupo, en la columna
    // de la derecha: así los proyectos ocuparon el hueco que quedaba debajo de
    // los demás bloques y el resumen sale en una sola hoja. Si algún día no
    // cupieran, se abrirían hojas siguientes de la misma forma y el resultado
    // seguiría siendo correcto, solo que repartido en más páginas.
    function grupos() {
        if (esLateral()) {
            var main = document.querySelector('.cv-card .main');
            return [
                {
                    forma: { cromo: 'side', columnas: 1 },
                    unidades: todos(':scope > .bloque', main).map(function (b) {
                        return unidad(b, null, '');
                    })
                }
            ];
        }

        var todas = unidadesVertical();
        return [
            {
                forma: { cromo: 'header', columnas: 2 },
                unidades: todas.filter(function (u) { return !u.proyectos; })
            },
            {
                forma: { cromo: null, columnas: 2, iguales: true },
                unidades: todas.filter(function (u) { return u.proyectos; })
            }
        ];
    }

    /* ======================================================================
       5. Escenario
       ====================================================================== */

    var escenario = null;
    var estilos = null;
    var devueltos = [];
    var esperandoImpresion = false;

    // Apunta dónde estaba un nodo para devolverlo luego.
    function apuntar(nodo) {
        devueltos.push({ nodo: nodo, padre: nodo.parentNode, siguiente: nodo.nextSibling });
    }

    function devolver() {
        // Al revés del orden de salida, que es como se deshacen los traslados.
        devueltos.reverse().forEach(function (d) {
            if (!d.padre) return;
            d.padre.appendChild(d.nodo);
            if (d.siguiente && d.siguiente.parentNode === d.padre) {
                d.padre.insertBefore(d.nodo, d.siguiente);
            }
        });
        devueltos = [];
    }

    // El escenario es una caja por hoja, fuera de la vista. Va muy lejos a la
    // izquierda en vez de con visibility:hidden porque así el navegador lo
    // maqueta de verdad y las medidas que se toman son las que acabarán viendo
    // las imágenes.
    function crearEscenario() {
        var d = diseno();
        var caja = crear('div', 'pdf-escenario' + (esLateral() ? '' : ' pdf-escenario--vertical'));
        caja.style.width = d.ancho + 'px';
        caja.setAttribute('aria-hidden', 'true');
        document.body.appendChild(caja);
        return caja;
    }

    // Una caja es la tarjeta tal cual la usa la web, con las mismas clases y el
    // ancho y alto de una hoja. Se reutilizan las clases a propósito: lo que se
    // mide es lo que se ve.
    function crearCaja(forma, cromo) {
        var d = diseno();
        // Sin barra lateral el cuerpo ocupa todo el ancho, como en la vista web.
        var ancha = esLateral() && cromo !== 'side';
        var caja = crear('div', 'cv-card' + (ancha ? ' cv-card--ancha' : ''));
        caja.style.width = d.ancho + 'px';
        caja.style.height = d.alto + 'px';

        if (cromo === 'side') {
            var lateral = document.querySelector('.cv-card > .side');
            if (lateral) {
                apuntar(lateral);
                caja.appendChild(lateral);
            }
        }
        if (cromo === 'header') {
            var cabecera = document.querySelector('.cv-card > .header');
            if (cabecera) {
                apuntar(cabecera);
                caja.appendChild(cabecera);
            }
        }

        var main = crear('div', 'main');
        var columnas = [main];

        if (forma.columnas === 2) {
            var izq = crear('div', 'col-izq');
            var der = crear('div', 'col-der');
            main.appendChild(izq);
            main.appendChild(der);
            columnas = [izq, der];
        }

        caja.appendChild(main);
        return { el: caja, columnas: columnas };
    }

    // Coloca una unidad en la columna y devuelve el nodo colocado. Si la
    // columna se queda corta, quien llame lo retira y lo prueba en la siguiente.
    function montar(u, columna, primero, tituloPrevio) {
        var nodo;

        if (!u.piezas) {
            nodo = u.envoltorio;
            apuntar(nodo);
            columna.appendChild(nodo);
        } else {
            nodo = u.envoltorio.cloneNode(false);      // <div class="seccion"> vacío
            // El título solo se pone al abrir una columna, y si no es la
            // continuación de la misma sección: si no, se repetiría en cada
            // columna el encabezado de una lista que se ve continuar.
            if (primero && u.titulo && u.titulo !== tituloPrevio) {
                var h = u.envoltorio.querySelector('h2, h3');
                if (h) nodo.appendChild(h.cloneNode(true));
            }
            u.piezas.forEach(function (p) {
                apuntar(p);
                nodo.appendChild(p);
            });
            columna.appendChild(nodo);
        }

        return nodo;
    }

    /* ======================================================================
       6. Reparto
       ====================================================================== */

    // Coloca las unidades una a una midiendo después de cada una. En cuanto
    // una no cabe, pasa a la siguiente columna; si no quedan columnas, se abre
    // otra hoja con la misma forma. Nada se parte nunca por la mitad.
    function repartir(unidades, forma, conCromo) {
        var pendientes = unidades.slice();
        var cajas = [];
        var tituloPrevio = null;
        var cromo = conCromo ? forma.cromo : null;
        var demasiadoAlto = 0;

        while (pendientes.length) {
            var caja = crearCaja(forma, cromo);
            // La caja se engancha al escenario antes de llenarse: si estuviera
            // suelta, el navegador no la maquetaría y todas las medidas darían 0.
            // El salto va entre cajas, no en la última: un "break-after" en la
            // última carta dejaba siempre una hoja en blanco detrás.
            if (escenario.firstChild) escenario.appendChild(crear('div', 'pdf-salto'));
            escenario.appendChild(caja.el);
            var colocadas = 0;

            for (var c = 0; c < caja.columnas.length && pendientes.length; c++) {
                var columna = caja.columnas[c];
                var primera = true;

                while (pendientes.length) {
                    var u = pendientes[0];
                    var nodo = montar(u, columna, primera, tituloPrevio);

                    if (cabe(columna)) {
                        tituloPrevio = u.titulo;
                        pendientes.shift();
                        primera = false;
                        colocadas++;
                        continue;
                    }

                    if (columna.childNodes.length === 0) {
                        // El bloque es más alto que una hoja entera. Se deja
                        // donde está y se avisa: cortarlo sería peor.
                        demasiadoAlto++;
                        tituloPrevio = u.titulo;
                        pendientes.shift();
                    } else {
                        columna.removeChild(nodo);
                    }
                    break;
                }
            }

            cajas.push(caja.el);
            cromo = null;              // el cromo solo va en la primera hoja

            if (colocadas === 0) break;    // no insistir: no entra nada
        }

        if (demasiadoAlto) {
            console.warn('pdf.js: ' + demasiadoAlto + ' bloque(s) más alto(s) que una hoja.');
        }
        return { cajas: cajas, sobran: pendientes };
    }

    function repartirTodo() {
        var cajas = [];
        grupos().forEach(function (grupo, i) {
            var r = repartir(grupo.unidades, grupo.forma, i === 0);
            cajas = cajas.concat(r.cajas);
            if (r.sobran.length) {
                console.warn('pdf.js: ' + r.sobran.length + ' bloque(s) sin sitio.');
            }
        });
        return cajas;
    }

    // La barra lateral no se puede partir, así que hay que comprobar que entra
    // entera. Si no, se le baja la escala un poco antes que recortarla abajo.
    function ajustarLateral() {
        var lateral = escenario.querySelector('.side');
        if (!lateral || cabe(lateral)) return;
        for (var escala = 96; escala >= 84; escala -= 4) {
            lateral.style.zoom = (escala / 100).toFixed(2);
            if (cabe(lateral)) {
                console.warn('pdf.js: la barra lateral no cabía entera; sale al ' + escala + '%.');
                return;
            }
        }
        lateral.style.zoom = '';
        console.warn('pdf.js: la barra lateral se sale de la hoja.');
    }

    /* ======================================================================
       7. Estilos del escenario y de la impresión
       ====================================================================== */

    function hojaDeEstilos() {
        var d = diseno();

        // Al imprimir, el ancho útil son 733 px de pantalla, así que la caja
        // hay que reducirla a esa medida. El margen de la impresora y el del
        // diálogo se suman al de @page, y con la caja justa Chrome la volcaba a
        // una segunda hoja en blanco; el 0,975 deja ~5 mm de aire por lado para
        // que quepa aunque la impresora pida más margen del que dice el CSS.
        var zoom = Math.min(733.2 / d.ancho, 1060.5 / d.alto) * 0.975;
        zoom = Math.floor(zoom * 10000) / 10000;

        var estilo = crear('style', 'pdf-estilo');
        estilo.textContent = [
            '.pdf-escenario {',
            '    position: fixed;',
            '    left: -30000px;',
            '    top: 0;',
            '    z-index: -1;',
            '    pointer-events: none;',
            '}',

            // El ancho y el alto van en línea porque dependen de la plantilla.
            // Se fuerzan como flex: así el alto de la hoja se reparte entre las
            // piezas y las columnas tienen una altura buena con la que medir.
            '.pdf-escenario .cv-card {',
            '    display: flex;',
            '    width: ' + d.ancho + 'px !important;',
            '    max-width: ' + d.ancho + 'px !important;',
            '    height: ' + d.alto + 'px !important;',
            '    margin: 0;',
            '    box-shadow: none;',
            '    flex-direction: row;',
            '    overflow: hidden;',
            '}',

            // En vertical la cabecera va arriba y el cuerpo toma el resto.
            '.pdf-escenario--vertical .cv-card { flex-direction: column; }',
            '.pdf-escenario--vertical .main { flex: 1 1 auto; min-height: 0; }',
            '.pdf-escenario--vertical .header { flex: 0 0 auto; }',

            // Con barra lateral la caja es una fila: barra + una columna. En la
            // plantilla vertical el cuerpo va a todo el ancho, así que estas
            // reglas se limitan a la variante con barra.
            '.pdf-escenario:not(.pdf-escenario--vertical) .side {',
            '    width: 32%;',
            '    border-bottom: none;',
            '    border-right: 1px solid #7a9fdf;',
            '}',
            '.pdf-escenario:not(.pdf-escenario--vertical) .main { width: 68%; }',
            '.pdf-escenario:not(.pdf-escenario--vertical) .cv-card--ancha .main { width: 100%; }',

            // El alto de las columnas es el de la hoja y no dejan crecer: es lo
            // que permite medir si un bloque cabe sin partirlo.
            '.pdf-escenario .main { min-height: 0; overflow: hidden; }',
            '.pdf-escenario .col-izq,',
            '.pdf-escenario .col-der { height: 100%; min-height: 0; overflow: hidden; }',

            // El resumen va justo: se aprieta un poco el aire entre bloques para
            // que todo quepa en una sola hoja con margen de sobra y no al filo.
            '.pdf-escenario:not(.pdf-escenario--vertical) .main {',
            '    padding-top: 10px;',
            '    padding-bottom: 10px;',
            '}',
            '.pdf-escenario:not(.pdf-escenario--vertical) .bloque { margin-bottom: 9px; }',
            '.pdf-escenario:not(.pdf-escenario--vertical) .proj {',
            '    margin-bottom: 4px;',
            '    padding: 6px 12px;',
            '}',

            // Dos columnas a partes iguales en las hojas de proyectos.
            '.pdf-escenario .main.pdf-pares .col-izq,',
            '.pdf-escenario .main.pdf-pares .col-der { width: 50%; }',

            // En el escenario nada se corta a mitad de bloque.
            '.pdf-escenario .tl-item, .pdf-escenario .proj,',
            '.pdf-escenario .educ-item, .pdf-escenario .item,',
            '.pdf-escenario .proyecto, .pdf-escenario .seccion { break-inside: avoid; }',

            // Barra lateral apretada: menos aire entre bloques y letra menor.
            '.pdf-escenario .side.side-ajustada { gap: 11px; }',
            '.pdf-escenario .side.side-ajustada .contacto { font-size: .74rem; gap: 5px; }',
            '.pdf-escenario .side.side-ajustada .chip { font-size: .67rem; padding: 2px 7px; }',
            '.pdf-escenario .side.side-ajustada .disp { margin-top: 8px; }',

            '@page { size: A4 portrait; margin: ' + MARGEN + 'mm; }',
            '@media print {',
            '    body.pdf-activo > *:not(.pdf-escenario) { display: none !important; }',
            // El sitio es oscuro y lleva aire alrededor: sin neutralizarlo, ese
            // relleno se suma a la caja y la hoja se desborda a una segunda en
            // blanco, que es justo lo que pasaba al imprimir.
            '    html { margin: 0 !important; padding: 0 !important; }',
            '    body.pdf-activo {',
            '        margin: 0 !important;',
            '        padding: 0 !important;',
            '        background: #fff !important;',
            '    }',
            '    .pdf-escenario {',
            '        position: static;',
            '        left: auto;',
            '        width: auto !important;',
            '        z-index: auto;',
            '    }',
            '    .pdf-escenario .cv-card { zoom: ' + zoom + '; }',
            '    .pdf-escenario .pdf-salto { break-before: page; height: 0; }',
            '}',
            ''
        ].join('\n');

        document.head.appendChild(estilo);
        return estilo;
    }

    /* ======================================================================
       8. Capa de texto
       ====================================================================== */

    // Las fuentes estándar de PDF solo cubren Latin-1. Los símbolos
    // tipográficos y los emojis no existen ahí y, si se dejan, jsPDF da error y
    // la línea se queda a medias: por eso se cambian por su equivalente y se
    // quita lo que no tenga ninguno. Los acentos sí están y se respetan.
    function limpiar(txt) {
        return txt
            .replace(/[\u2010-\u2015\u2212\u00ad]/g, '-')     // guiones largos
            .replace(/[\u2018\u2019\u201a\u201b]/g, "'")     // comillas simples
            .replace(/[\u201c\u201d\u201e\u201f]/g, '"')     // comillas dobles
            .replace(/\u2026/g, '...')                      // elipsis
            .replace(/[\u00a0\u1680\u2000-\u200b\u202f\u205f\u3000]/g, ' ')  // espacios
            .replace(/[\u2022\u25aa\u25cf\u2043]/g, '\u00b7')  // viñetas -> punto medio
            .replace(/[\u2190-\u2193]/g, '->')               // flechas
            .replace(/[\u2264\u2265]/g, '<=')                // <= >=
            .replace(/[\u00ab\u00bb]/g, '"')
            // Solo Latin-1: el PDF usa Helvetica con WinAnsiEncoding, y lo que
            // se salga de ahí (emojis, símbolos, espacios Unicode) se pierde.
            .replace(/[^\u0020-\u00ff]/g, ' ')
            .replace(/[ \t]{2,}/g, ' ')
            .trim();
    }

    // La imagen lleva el texto dibujado, pero incrustado como imagen no se
    // puede buscar ni copiar: no se busca el correo ni lo lee un sistema de
    // selección. Se vuelve a escribir encima en blanco invisible, que es como
    // se hacen las capas de texto de un PDF escaneado. Si algo falla, el PDF
    // sale igual: solo que sin texto seleccionable.
    function capaDeTexto(doc, caja, mmPorPx) {
        var origen = caja.getBoundingClientRect();
        var rango = document.createRange();
        var lineas = [];
        var paseo = document.createTreeWalker(caja, NodeFilter.SHOW_TEXT, null);
        var nodo;

        function anotar(linea) {
            if (!linea) return;
            var txt = limpiar(linea.txt);
            if (!txt) return;
            lineas.push({
                x: (linea.izq - origen.left) * mmPorPx,
                y: (linea.base - origen.top) * mmPorPx,
                // El alto del recuadro de la línea se aproxima al cuerpo de la
                // letra (x0.78) y se pasa a puntos, que es lo que mide jsPDF.
                tam: linea.alto * 0.78 * mmPorPx * 2.8346,
                txt: txt
            });
        }

        while ((nodo = paseo.nextNode())) {
            if (!nodo.nodeValue || !nodo.nodeValue.trim()) continue;
            if (!visible(nodo.parentNode)) continue;

            var texto = nodo.nodeValue;
            var linea = null;

            // Un nodo de texto puede ocupar varias líneas, así que se recorre
            // carácter a carácter y se agrupa por línea: cada trozo se dibuja en
            // el sitio que le toca y no en el de arriba del todo.
            for (var i = 0; i < texto.length; i++) {
                rango.setStart(nodo, i);
                rango.setEnd(nodo, i + 1);
                var r = rango.getClientRects()[0];
                if (!r || (!r.width && !r.height)) continue;

                var ch = texto[i];
                if (/\s/.test(ch) && linea) {
                    linea.txt += ch;
                    continue;
                }

                var arriba = Math.round(r.top * 2) / 2;
                if (!linea || Math.abs(arriba - linea.arriba) > 3) {
                    anotar(linea);
                    linea = {
                        arriba: arriba,
                        alto: r.height,
                        base: r.bottom - r.height * 0.22,
                        izq: r.left,
                        txt: ch
                    };
                } else {
                    linea.txt += ch;
                    linea.base = Math.max(linea.base, r.bottom - r.height * 0.22);
                }
            }
            anotar(linea);
        }

        doc.setFont('helvetica', 'normal');
        lineas.forEach(function (l) {
            if (l.tam < 3 || l.tam > 40) return;
            try {
                // renderingMode es el nombre de la opción en jsPDF; 'invisible'
                // es el modo 3 de PDF, que no dibuja pero deja el texto.
                doc.text(l.txt, l.x, l.y, {
                    baseline: 'alphabetic', fontSize: l.tam, renderingMode: 'invisible'
                });
            } catch (e) { /* una línea que no se dibuja no rompe el PDF */ }
        });
    }

    /* ======================================================================
       9. PDF
       ====================================================================== */

    function esperarFotos(raiz) {
        return Promise.all(todos('img', raiz).map(function (f) {
            if (f.complete && f.naturalWidth) return null;
            return new Promise(function (listo) {
                f.addEventListener('load', listo, { once: true });
                f.addEventListener('error', listo, { once: true });
            });
        }));
    }

    function nombreArchivo() {
        var v = document.body.dataset.variante;
        return 'Curriculum_Cristian_Ginarte' + (v ? '_' + v : '') + '.pdf';
    }

    var botonOriginal = null;

    function estadoBoton(texto, ocupado) {
        var b = document.querySelector('.btn-print');
        if (!b) return;
        if (botonOriginal === null) botonOriginal = b.textContent;
        if (texto === null) {
            b.textContent = botonOriginal;
            b.disabled = false;
            b.classList.remove('btn-print--ocupado');
            return;
        }
        b.textContent = texto;
        b.disabled = !!ocupado;
        b.classList.toggle('btn-print--ocupado', !!ocupado);
    }

    function desarmar() {
        devolver();
        if (escenario && escenario.parentNode) escenario.parentNode.removeChild(escenario);
        escenario = null;
        if (estilos && estilos.parentNode) estilos.parentNode.removeChild(estilos);
        estilos = null;
        document.body.classList.remove('pdf-activo');
    }

    function escenaLista() {
        estilos = hojaDeEstilos();
        escenario = crearEscenario();
        document.body.classList.add('pdf-activo');
        var cajas = repartirTodo();
        ajustarLateral();
        return cajas;
    }

    // Si la página se abre desde el disco (doble clic en el .html), el
    // navegador considera que la foto viene de otro sitio y "mancha" el
    // lienzo: entonces no deja exportarlo y el PDF no se puede descargar. Se
    // comprueba antes de trabajar y, si pasa, se cae al diálogo de impresión,
    // donde el navegador sí dibuja la imagen. En la web publicada no pasa.
    function lienzoManchado() {
        try {
            var fotos = todos('img', escenario || document);
            if (!fotos.length) return false;
            var lienzo = document.createElement('canvas');
            lienzo.width = lienzo.height = 1;
            lienzo.getContext('2d').drawImage(fotos[0], 0, 0, 1, 1);
            lienzo.toDataURL();
            return false;
        } catch (e) {
            return true;
        }
    }

    function generarPDF() {
        if (escenario) return Promise.resolve();      // ya hay una en marcha

        if (!window.html2canvas || !window.jspdf) {
            estadoBoton('⚠ Falta la librería', false);
            console.error('pdf.js: no se cargó html2canvas o jsPDF. Revisa la conexión.');
            setTimeout(function () { estadoBoton(null); }, 2600);
            return Promise.resolve();
        }

        var cajas;
        try {
            cajas = escenaLista();
        } catch (error) {
            desarmar();
            estadoBoton(null);
            throw error;
        }

        if (lienzoManchado()) {
            estadoBoton('Elige «Guardar como PDF» en el diálogo', false);
            esperandoImpresion = true;
            window.print();
            // Red de seguridad por si el navegador no avisa con afterprint:
            // sin esto la página se quedaría oculta detrás del diálogo.
            setTimeout(function () {
                if (esperandoImpresion) desarmar();
            }, 45000);
            return Promise.resolve();
        }

        var d = diseno();
        var mmPorPx = CAJA.ancho / d.ancho;
        var doc = new window.jspdf.jsPDF({
            unit: 'mm', format: 'a4', orientation: 'portrait', compress: true
        });

        estadoBoton('Generando PDF…', true);

        var salir = function (ok) {
            desarmar();
            estadoBoton(ok ? '✓ PDF listo' : '⚠ No se pudo generar', false);
            setTimeout(function () { estadoBoton(null); }, 1800);
        };

        return esperarFotos(escenario)
            .then(function () {
                return cajas.reduce(function (anterior, caja, i) {
                    return anterior.then(function () {
                        if (i > 0) doc.addPage();
                        // El texto va antes que la imagen: la imagen es opaca y
                        // lo tapa entero, así que la capa sigue siendo
                        // seleccionable sin verse aunque el lector no honre el
                        // modo de dibujo invisible.
                        if (TEXTO) {
                            try { capaDeTexto(doc, caja, mmPorPx); } catch (e) { /* solo texto */ }
                        }
                        return window.html2canvas(caja, {
                            scale: ESCALA,
                            backgroundColor: '#ffffff',
                            useCORS: true,
                            logging: false,
                            width: d.ancho,
                            height: d.alto,
                            windowWidth: d.ancho,
                            windowHeight: d.alto
                        }).then(function (lienzo) {
                            // La altura se saca del propio lienzo para no
                            // deformar ni un milímetro la imagen.
                            var alto = CAJA.ancho * (lienzo.height / lienzo.width);
                            doc.addImage(
                                lienzo.toDataURL('image/jpeg', 0.92), 'JPEG',
                                MARGEN, MARGEN, CAJA.ancho, alto, undefined, 'FAST'
                            );
                        });
                    });
                }, Promise.resolve());
            })
            .then(function () {
                doc.save(nombreArchivo());
                salir(true);
            })
            .catch(function (error) {
                salir(false);
                console.error('pdf.js:', error);
            });
    }

    /* ======================================================================
       10. Impresión y arranque
       ====================================================================== */

    // Ctrl+P imprime el mismo reparto que el botón, no la tarjeta cortada.
    function imprimir() {
        if (escenario) return;
        try {
            escenaLista();
        } catch (error) {
            console.error('pdf.js:', error);
            desarmar();
        }
    }

    function alImprimir() {
        esperandoImpresion = false;
        desarmar();
    }

    window.addEventListener('beforeprint', imprimir);
    window.addEventListener('afterprint', alImprimir);

    window.generarPDF = generarPDF;
})();
