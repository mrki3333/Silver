// Firebase konfiguracija
const firebaseConfig = {
    apiKey: "AIzaSyCJMWYFiXFXLFqyE4TwADwdLgNfTIHuXUg",
    authDomain: "silver-fa4e9.firebaseapp.com",
    databaseURL: "https://silver-fa4e9-default-rtdb.europe-west1.firebasedatabase.app/",
    projectId: "silver-fa4e9",
    storageBucket: "silver-fa4e9.firebasestorage.app",
    messagingSenderId: "993522816037",
    appId: "1:993522816037:web:2ca86066b63df96c169bcc",
};
firebase.initializeApp(firebaseConfig);
firebase.analytics();

var invoices = firebase.database().ref("Invoices");
var items = firebase.database().ref("Items");

let currentInvoiceId = null;
let sum = 0;

const stavkeForm = document.getElementById("stavkeForm");
const ukupnaCijenaDiv = document.getElementById("ukupnaCijenaDiv");
const ukupnaCijenaDiv2 = document.getElementById("ukupnaCijenaDiv2");
const stavkeDiv = document.getElementById("stavkeDiv");

// Funkcija za grupiranje računa po mjesecu i godini
function groupInvoicesByMonth(invoices) {
    const groupedInvoices = {};

    invoices.forEach((invoice) => {
        const date = new Date(invoice.date);

        let key;
        if (isNaN(date.getTime())) {
            key = "Nedovršeni računi/ponude"; // Ako je datum neispravan
        } else {
            const year = date.getFullYear();
            const month = String(date.getMonth() + 1).padStart(2, '0');
            key = `${month}/${year}`; // Formatirano kao MM/YYYY
        }

        if (!groupedInvoices[key]) {
            groupedInvoices[key] = [];
        }
        
        groupedInvoices[key].push(invoice);
    });

    return groupedInvoices;
}


// Element za prikaz računa
const racuniLista = document.getElementById('racuniLista');

async function loadInvoicesGroupedByMonth() {
    const snapshot = await firebase.database().ref('Invoices').once('value');
    const invoices = snapshot.exists() ? Object.values(snapshot.val()) : [];

    const groupedInvoices = groupInvoicesByMonth(invoices);

    // Resetiraj listu računa
    racuniLista.innerHTML = '';

    // Prikaz grupiranih računa
    Object.keys(groupedInvoices)
        .sort((a, b) => new Date(b.split('/')[1], b.split('/')[0] - 1) - new Date(a.split('/')[1], a.split('/')[0] - 1)) // Sortiraj po mjesecu/godini
        .forEach((key) => {
            const monthYearDiv = document.createElement('div');
            monthYearDiv.classList.add('monthYear');
            monthYearDiv.innerHTML = `<h3>${key}</h3>`; // Prikaz mjeseca/godine

            const invoiceList = document.createElement('div');
            invoiceList.classList.add('invoiceList');
            invoiceList.style.display = 'none'; // Sakrij račune dok korisnik ne klikne na naslov

            // Sortiraj račune unutar mjeseca po datumu
            groupedInvoices[key]
                .sort((a, b) => new Date(b.date) - new Date(a.date)) // Sortiraj po datumu unutar mjeseca (najnoviji prvi)
                .forEach((invoice) => {
                    const racunDiv = document.createElement('div');
                    racunDiv.classList.add('racun');

                    const formattedDate = formatDate(invoice.date);

                    racunDiv.innerHTML = `

                    <button class="download" data-id="${invoice.id}"></button>
                    <p><span style="font-weight: bold;">TIP:</span> ${invoice.type}</p>
                    <p><span style="font-weight: bold;">DATUM:</span> ${formattedDate}</p>
                    <p><span style="font-weight: bold;">BROJ:</span> ${invoice.invoiceNumber}</p>
                    <p><span style="font-weight: bold;">KUPAC:</span> ${invoice.buyer}</p>
                    <p><span style="font-weight: bold;">CIJENA:</span> ${invoice.totalPrice} €</p>
                    <div class="dvaButtona">
                        <button class="recreateButton" data-id="${invoice.id}">Rekreiraj</button>
                        <button class="openButton" data-id="${invoice.id}">Otvori</button>
                        <button class="deleteButton" data-id="${invoice.id}">Obriši</button>
                    </div>
                    `;

                    racunDiv.querySelector('.openButton').addEventListener('click', () => {
                        window.location.href = `./izrada.html?id=${invoice.id}`;
                    });

                    racunDiv.querySelector('.deleteButton').addEventListener('click', async (e) => {
                        const id = e.target.getAttribute('data-id');
                        // Dodaj potvrdu za brisanje računa
                        const confirmDelete = confirm('Jeste li sigurni da želite obrisati ovaj račun?');
                        if (!confirmDelete) {
                            return; // Ako korisnik odustane, prekini funkciju
                        }
                    
                        // Obriši račun
                        await firebase.database().ref(`Invoices/${id}`).remove();
                    
                        // Obriši stavke povezane s računom
                        const itemsSnapshot = await firebase.database().ref('Items').orderByChild('invoiceId').equalTo(id).once('value');
                        if (itemsSnapshot.exists()) {
                            itemsSnapshot.forEach((childSnapshot) => {
                                childSnapshot.ref.remove(); // Brisanje svake stavke povezane s računom
                            });
                        }
                    
                        // Ponovno učitaj račune
                        loadInvoicesGroupedByMonth();
                    });
                    
                    racunDiv.querySelector('.download').addEventListener('click', async (e) => {
                        const invoiceId = e.target.getAttribute('data-id');  
                    
                        // Dohvati račun iz Firebase baze podataka
                        const invoiceSnapshot = await firebase.database().ref(`Invoices/${invoiceId}`).once('value');
                        const invoice = invoiceSnapshot.val();
                        if (!invoice) {
                            alert('Račun nije pronađen!');
                            return;
                        }
                    
                        // Dohvati sve stavke povezane s računom
                        const itemsSnapshot = await firebase.database().ref('Items').orderByChild('invoiceId').equalTo(invoiceId).once('value');
                        const items = itemsSnapshot.exists() ? Object.values(itemsSnapshot.val()) : [];
                    
                        console.log("Podaci o računu:", invoice);
                        console.log("Stavke računa:", items);
                    
                        // Proslijedi sve podatke funkciji generatePdf()
                        generatePdf(
                            invoice.buyer,
                            invoice.adress,
                            invoice.oib,
                            invoice.type,
                            invoice.invoiceNumber,
                            invoice.date,
                            invoice.time,
                            invoice.totalPrice,
                            items // Proslijedi stavke kao parametar
                        );
                    });
                    




                    invoiceList.appendChild(racunDiv);
                });

            // Klik za prikaz/sakrivanje računa
            monthYearDiv.addEventListener('click', () => {
                invoiceList.style.display =
                    invoiceList.style.display === 'none' ? 'block' : 'none';
            });

            racuniLista.appendChild(monthYearDiv);
            racuniLista.appendChild(invoiceList);
        });
}










// Event listener za gumb "Rekreiraj"
document.addEventListener('click', async (event) => {
    if (event.target.classList.contains('recreateButton')) {
        const originalInvoiceId = event.target.getAttribute('data-id');

        // Dohvati originalni račun
        const originalInvoiceSnapshot = await firebase.database().ref(`Invoices/${originalInvoiceId}`).once('value');
        const originalInvoice = originalInvoiceSnapshot.val();

        if (!originalInvoice) {
            alert('Račun nije pronađen!');
            return;
        }

        // Kreiraj novi račun s istim podacima, ali bez datuma i vremena
        const newInvoiceRef = firebase.database().ref('Invoices').push();
        const newInvoiceId = newInvoiceRef.key;

        await newInvoiceRef.set({
            ...originalInvoice,
            id: newInvoiceId,
            date: '', // Datum ostavi prazan
            time: '', // Vrijeme ostavi prazno
            invoiceNumber: '', // Dodaj oznaku kopije
            totalPrice: 0, // Početna ukupna cijena
        });

        // Dohvati stavke povezane s originalnim računom
        const itemsSnapshot = await items.orderByChild("invoiceId").equalTo(originalInvoiceId).once("value");
        const originalItems = itemsSnapshot.exists() ? Object.values(itemsSnapshot.val()) : [];

        // Kopiraj stavke u novi račun
        for (const item of originalItems) {
            const newItemRef = firebase.database().ref('Items').push();
            await newItemRef.set({
                ...item,
                invoiceId: newInvoiceId,
            });
        }

        // Preusmjeri korisnika na stranicu za uređivanje novog računa
        window.location.href = `./izrada.html?id=${newInvoiceId}`;
    }
});

function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}



async function generatePdf(buyer, adress, oib, type, invoiceNumber, date, time, totalPrice, items) {
    let priceInCents = Math.round(totalPrice * 100);
    // Formatiraj broj na 15 znamenki s vodećim nulama
    priceInCents = priceInCents.toString().padStart(15, '0');
    let newDate = (formatDate(date));
    newDate = newDate.replace(".", "-");
    newDate = newDate.replace(".", "-");
    const hub3_code = 
    "HRVHUB30\n" + 
    "EUR\n" +
    priceInCents + "\n"+
    buyer + "\n" +
    "\n"+
    "\n"+
    "\n"+
    "\n"+
    "\n"+
    "HR8123400091160404436\n"+
    "HR00\n"+
    newDate + "\n" +
    "\n"+
    "Plaćanje računa br." + invoiceNumber; 

    // Generiraj bar kod
    PDF417.init(hub3_code);
    var barcode = PDF417.getBarcodeArray();
    var bw = 2; // širina bloka
    var bh = 2; // visina bloka

    // Kreiraj canvas za bar kod
    var canvas = document.createElement('canvas');
    canvas.width = bw * barcode['num_cols'];
    canvas.height = bh * barcode['num_rows'];
    var ctx = canvas.getContext('2d');
    var y = 0;
    for (var r = 0; r < barcode['num_rows']; ++r) {
        var x = 0;
        for (var c = 0; c < barcode['num_cols']; ++c) {
            if (barcode['bcode'][r][c] == 1) {
                ctx.fillRect(x, y, bw, bh);
            }
            x += bw;
        }
        y += bh;
    }

    // Konvertiraj canvas u URL
    var imageDataUrl = canvas.toDataURL('image/png');

    
    
    function inchesToPoints(inches) {
        return inches * 72; // 1 inch = 72 points
    }

    // Postavi dimenzije A4 stranice u inchima
    const paperWidthInches = 8.27;
    const paperHeightInches = 11.69;
    const pageWidth = inchesToPoints(paperWidthInches);
    const pageHeight = inchesToPoints(paperHeightInches);
        const { PDFDocument, rgb } = PDFLib

    async function embedFontAndMeasureText() {
			// Fetch custom font
      const url1 = 'Calibri.ttf'
      const url2 = 'CalibriBold.ttf'
      const fontBytes1 = await fetch(url1).then(res => res.arrayBuffer())
      const fontBytes2 = await fetch(url2).then(res => res.arrayBuffer())
      // Create a new PDFDocument
      const urla= 'racunponuda.pdf'; // Provjerite putanju PDF-a
        const existingPdfBytes = await fetch(urla).then(res => {
            if (!res.ok) {
                throw new Error('PDF nije pronađen!');
            }
            return res.arrayBuffer();
        });

        // Učitaj PDF pomoću pdf-lib
        const pdfDoc = await PDFLib.PDFDocument.load(existingPdfBytes);
        const pages = pdfDoc.getPages();
        const firstPage = pages[0]; // Pretpostavljamo da dodajemo tekst na prvu stranicu

      // Register the `fontkit` instance
      pdfDoc.registerFontkit(fontkit)

      // Embed our custom font in the document
      const Calibri = await pdfDoc.embedFont(fontBytes1);
      const CalibriBold = await pdfDoc.embedFont(fontBytes2);
    
    
      const pngImage = await pdfDoc.embedPng(imageDataUrl);
      const pngDims = pngImage.scale(0.55);  // Prilagodi veličinu slike
  

      // Dodaj bar kod u donji lijevi kut (koristimo koordinate x = 50, y = 50)
      if(type == "Račun"){
        firstPage.drawImage(pngImage, {
            x: inchesToPoints(1.2),  // Donji lijevi kut
            y: pageHeight - inchesToPoints(10.2),
            width: (pngDims.width)*0.85,
            height: (pngDims.height)*0.85,
        });
      }

        // Dodajemo tekstove pomoću funkcije drawTextWithoutKerning
        function drawTextWithoutKerning(page, text, x, y, font, fontSize, color) {
            let offsetX = x;
            for (let char of text) {
                const charWidth = font.widthOfTextAtSize(char, fontSize);
                page.drawText(char, {
                    x: offsetX,
                    y: y,
                    size: fontSize,
                    font: font,
                    color: color,
                });
                offsetX += charWidth;
            }
        }

        // Koristimo drawTextWithoutKerning za ispis svih elemenata
        drawTextWithoutKerning(firstPage, buyer, inchesToPoints(4.12) - Calibri.widthOfTextAtSize(buyer, 11) / 2, pageHeight - inchesToPoints(2.71), Calibri, 11, rgb(0, 0, 0));

        drawTextWithoutKerning(firstPage, adress, inchesToPoints(4.12) - Calibri.widthOfTextAtSize(adress, 11) / 2, pageHeight - inchesToPoints(3.01), Calibri, 11, rgb(0, 0, 0));

        drawTextWithoutKerning(firstPage, oib, inchesToPoints(4.12) - Calibri.widthOfTextAtSize(oib, 11) / 2, pageHeight - inchesToPoints(3.32), Calibri, 11, rgb(0, 0, 0));

        drawTextWithoutKerning(firstPage, type + " br." + invoiceNumber, inchesToPoints(1.8) - Calibri.widthOfTextAtSize(invoiceNumber, 11) / 2, pageHeight - inchesToPoints(3.76), CalibriBold, 11, rgb(0, 0, 0));

        const formattedDate = formatDate(date);
        drawTextWithoutKerning(firstPage, " " + formattedDate + "  " + time, inchesToPoints(1.62), pageHeight - inchesToPoints(8.41), CalibriBold, 9, rgb(0, 0, 0));
        let totalPriceNew = totalPrice;
        totalPriceNew = parseFloat(totalPriceNew);
        totalPriceNew = totalPriceNew / 1.25;
        let totalPriceNew3 =  totalPriceNew;
        totalPriceNew = totalPriceNew.toFixed(2).replace(/\./g, ",");
        firstPage.drawText(totalPriceNew , {
            x: inchesToPoints(7.43) -  CalibriBold.widthOfTextAtSize(totalPriceNew, 11),
            y: pageHeight-inchesToPoints(7.81),
            size: 11,
            font: CalibriBold,
            color: rgb(0, 0, 0),
        })

        totalPriceNew3 = totalPriceNew3 * 0.25;
        totalPriceNew3 = totalPriceNew3.toFixed(2).replace(/\./g, ",");
        firstPage.drawText(totalPriceNew3, {
            x: inchesToPoints(7.43) - Calibri.widthOfTextAtSize(totalPriceNew3, 11),
            y: pageHeight-inchesToPoints(8),
            size: 11,
            font: Calibri,
            color: rgb(0, 0, 0),
        })
        let totalPriceNew2 = totalPrice;
        totalPriceNew2 = parseFloat(totalPriceNew2);
        totalPriceNew2 = totalPriceNew2.toFixed(2).replace(/\./g, ",");
        firstPage.drawText(totalPriceNew2, {
            x: inchesToPoints(7.43) -  CalibriBold.widthOfTextAtSize(totalPriceNew2, 11),
            y: pageHeight-inchesToPoints(8.2),
            size: 11,
            font: CalibriBold,
            color: rgb(0, 0, 0),
      })


      const maxItems = 7; // Maksimalni broj stavki koje želimo ispisati
      const maxWidth = inchesToPoints(3); // Maksimalna širina teksta u točkama
        const lineHeight = 10; // Visina između redaka u točkama (ovisno o veličini fonta)  
        const initialYCenter = pageHeight - inchesToPoints(4.64); // Početna vertikalna koordinata
        let currentY = initialYCenter; // Trenutna vertikalna pozicija za ispis

        items.forEach((item, index) => {
        // Ispis naziva stavke
        drawWrappedTextCentered(
            firstPage,
            item.name,
            inchesToPoints(1.1), // x koordinata (horizontalno centriranje događa se unutar funkcije)
            currentY, // Vertikalna središnja koordinata
            CalibriBold,
            9.5,
            maxWidth,
            lineHeight,
            rgb(0, 0, 0),
            Calibri
        );

        // Ispis jedinice
        drawTextWithoutKerning(firstPage, item.unit + ".", inchesToPoints(4.35) - Calibri.widthOfTextAtSize(item.unit + ".", 9) / 2, currentY - inchesToPoints(0.06), Calibri, 9, rgb(0, 0, 0));

        // Ispis količine
        drawTextWithoutKerning(firstPage, item.quantity + " ", inchesToPoints(4.95) - Calibri.widthOfTextAtSize(item.quantity + " ", 9) / 2, currentY - inchesToPoints(0.06), Calibri, 9, rgb(0, 0, 0));

        // Ispis cijene
        drawTextWithoutKerning(firstPage, item.price.toFixed(2).replace(/\./g, ",") + " €", inchesToPoints(5.79) - Calibri.widthOfTextAtSize(item.price.toFixed(2).replace(/\./g, ",") + " €", 9) / 2, currentY - inchesToPoints(0.06), Calibri, 9, rgb(0, 0, 0));

        // Ispis ukupne cijene (cijena * količina)
        drawTextWithoutKerning(firstPage, (item.price * item.quantity).toFixed(2).replace(/\./g, ",") + " €", inchesToPoints(6.84) - Calibri.widthOfTextAtSize((item.price * item.quantity).toFixed(2).replace(/\./g, ",") + " €", 9) / 2, currentY - inchesToPoints(0.06), Calibri, 9, rgb(0, 0, 0));


        // Ažuriranje y pozicije za sljedeću stavku
        if (index === 0) {
            currentY -= inchesToPoints(0.46); // Za prvu stavku (ako je samo jedna)
        } else {
            currentY -= inchesToPoints(0.4); // Za svaku sljedeću stavku
        }


        });
        const remainingRows = maxItems - items.length;
        for (let i = 0; i < remainingRows; i++) {
        // Ispis ukupne cijene (0,00 €)
        firstPage.drawText("0,00 €", {
            x: inchesToPoints(6.84) - Calibri.widthOfTextAtSize("0,00 €", 9) / 2,
            y: currentY - inchesToPoints(0.06),
            size: 9,
            font: Calibri,
            color: rgb(0, 0, 0),
        });

        // Ažuriranje y pozicije za sljedeći redak
        currentY -= inchesToPoints(0.38); // Koristimo istu visinu kao za ostale stavke
        }
        
        if(type == "Račun"){
            drawTextWithoutKerning(firstPage, "Račun sastavio: Silvije Barbarić", inchesToPoints(0.72), pageHeight - inchesToPoints(8.6), CalibriBold, 9, rgb(0, 0, 0));
        }
        else{
            drawTextWithoutKerning(firstPage, "Ponudu sastavio: Silvije Barbarić", inchesToPoints(0.72), pageHeight - inchesToPoints(8.6), CalibriBold, 9, rgb(0, 0, 0));
        }

      const pdfBytes = await pdfDoc.save()

      download(pdfBytes, type + "_" + invoiceNumber + "__DATUM:" + formattedDate + ".pdf", "application/pdf");
    

    }
    embedFontAndMeasureText();





    function drawWrappedTextCentered(page, text, x, yCenter, font, fontSize, maxWidth, lineHeight, color, font) {
        const words = text.split(" ");
        let line = "";
        let lines = [];
      
        // Kreiraj retke koji ne prelaze maxWidth
        for (let word of words) {
          const testLine = line + (line ? " " : "") + word;
          const lineWidth = font.widthOfTextAtSize(testLine, fontSize);
      
          if (lineWidth <= maxWidth) {
            line = testLine;
          } else {
            lines.push(line);
            line = word; // Započni novi redak
          }
        }
        // Dodaj zadnji red
        if (line) lines.push(line);
      
        // Izračunaj ukupnu visinu teksta
        const totalTextHeight = lines.length * lineHeight;
      
        // Početna y koordinata za centriranje teksta
        const yStart = yCenter + totalTextHeight / 2 - lineHeight;
      
        // Iscrtavanje svakog retka
        for (let i = 0; i < lines.length; i++) {
          const lineWidth = font.widthOfTextAtSize(lines[i], fontSize);
      
          // Centriraj svaki redak horizontalno
          page.drawText(lines[i], {
            x: x, // ovak se ne centrira po x osi
            //ovak se centrira po x osi//x: x - lineWidth / 2, 
            y: yStart - i * lineHeight,
            size: fontSize,
            font: font,
            color: color,
          });
        }
      }
}





// Učitaj račune pri pokretanju stranice
loadInvoicesGroupedByMonth();
