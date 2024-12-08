// Inicijalizacija baze
const db = new Dexie('PeroApp');
db.version(2).stores({
    items: '++id, name, quantity, unit, price, invoiceId', // Tabela za stavke
    invoice: '++id, type, date, time, invoiceNumber, buyer, adress, oib, totalPrice' // Tabela za račune
});

let currentInvoiceId = null; // Čuva ID trenutno kreiranog računa
let sum = 0;

const stavkeForm = document.getElementById('stavkeForm');
const ostaliPodatciForm = document.getElementById('ostaliPodatciForm');
const stavkeDiv = document.getElementById('stavkeDiv');
const ukupnaCijenaDiv = document.getElementById('ukupnaCijenaDiv');
const ukupnaCijenaDiv2 = document.getElementById('ukupnaCijenaDiv2');

// Funkcija za kreiranje računa (ako ne postoji)
async function createInvoiceIfNotExists() {
    if (!currentInvoiceId) {
        const type = document.querySelector('input[name="vrstaDokumenta"]:checked')?.value;
        const date = document.getElementById('datumRacuna').value;
        const time = document.getElementById('vrijemeRacuna').value;
        const invoiceNumber = document.getElementById('brojRacuna').value;
        const buyer = document.getElementById('kupac').value;
        const adress = document.getElementById('adresa').value;
        const oib = document.getElementById('OIB').value;

        // Validacija
        if (!type || !date || !time || !invoiceNumber || !buyer || !adress || !oib) {
            alert('Morate kreirati račun pre dodavanja stavki.');
            return null;
        }

        // Kreiraj račun i čuvaj njegov ID
        currentInvoiceId = await db.invoice.add({
            type,
            date,
            time,
            invoiceNumber,
            buyer,
            adress,
            oib,
            totalPrice: 0, // Početna ukupna cena
        });

        alert(`Račun kreiran s ID: ${currentInvoiceId}`);
    }
    return currentInvoiceId;
}

// Funkcija za dodavanje stavki u bazu
stavkeForm.onsubmit = async (event) => {
    event.preventDefault();

    // Proveri da li postoji račun, ako ne - kreiraj ga
    const invoiceId = await createInvoiceIfNotExists();

    if (!invoiceId) {
        alert('Morate kreirati račun pre dodavanja stavki.');
        return;
    }

    const name = document.getElementById('nazivStavke').value;
    const quantity = parseInt(document.getElementById('kolicinaStavke').value);
    const price = parseFloat(document.getElementById('cijenaStavke').value);
    const unit = document.getElementById('jedinicaMjere').value;

    if (!name || isNaN(quantity) || isNaN(price) || !unit) {
        alert('Molimo popunite sva polja na računu/ponudi');
        return;
    }

    // Dodavanje stavke u bazu
    const id = await db.items.add({ name, quantity, unit, price, invoiceId });

    // Dodaj stavku u DOM
    addStavkaToDOM({ id, name, quantity, unit, price });
    await updateInvoiceTotal(); // Ažuriraj ukupnu cenu računa
    stavkeForm.reset();
};

// Funkcija za dodavanje stavke u DOM
function addStavkaToDOM({ id, name, quantity, unit, price }) {
    const stavkaDiv = document.createElement('div');
    stavkaDiv.classList.add('stavke');
    stavkaDiv.dataset.id = id;

    stavkaDiv.innerHTML = `

        <div class="stavkeInfo">
            <p style="font-weight:bold">OPIS:</p>
            <p>${name}</p>
        </div>
        <div class="stavkeInfo">
            <p style="font-weight:bold">CIJENA:</p>
            <p>${price}€</p>
        </div>
        <div class="stavkeInfo">
            <p style="font-weight:bold">KOLIČINA:</p>
            <p>${quantity}</p>
        </div>
        <div class="stavkeInfo">
            <p style="font-weight:bold">JED. MJERE:</p>
            <p style="alling-items: center">${unit}</p>
        </div>
        <div class="stavkeInfo">
            <p style="font-weight:bold">IZNOS:</p>
            <p>${(price * quantity).toFixed(2)}€</p>
        </div>
        <button class="deleteButton">X</button>


    `;

    azuriranjeCijene(price, quantity);

    // Event za brisanje stavke
    stavkaDiv.querySelector('.deleteButton').addEventListener('click', deleteItem);
    stavkeDiv.appendChild(stavkaDiv);
}

// Funkcija za ažuriranje ukupne cene u DOM-u
function azuriranjeCijene(price, quantity) {
    sum += price * quantity;
    ukupnaCijenaDiv.textContent = `Ukupna cijena: ${sum.toFixed(2)} €`;
    ukupnaCijenaDiv2.textContent = `Ukupna cijena s PDV-om: ${(sum * 1.25).toFixed(2)} €`;
}

// Funkcija za ažuriranje ukupne cene u bazi
async function updateInvoiceTotal() {
    const items = await db.items.where({ invoiceId: currentInvoiceId }).toArray();
    const totalPrice = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
    await db.invoice.update(currentInvoiceId, { totalPrice: (totalPrice * 1.25).toFixed(2) }); // Sačuvaj cenu sa PDV-om
}

// Funkcija za brisanje stavke
async function deleteItem(event) {
    const stavkaDiv = event.target.closest('.stavke');
    const itemId = parseInt(stavkaDiv.dataset.id);

    // Dohvati stavku iz baze pre brisanja
    const item = await db.items.get(itemId);
    sum -= item.price * item.quantity;

    // Ažuriraj ukupnu cenu
    ukupnaCijenaDiv.textContent = `Ukupna cijena: ${sum.toFixed(2)} €`;
    ukupnaCijenaDiv2.textContent = `Ukupna cijena s PDV-om: ${(sum * 1.25).toFixed(2)} €`;

    // Brisanje iz baze i DOM-a
    await db.items.delete(itemId);
    stavkaDiv.remove();
    await updateInvoiceTotal(); // Ažuriraj ukupnu cenu računa
}

// Učitavanje računa i stavki ako je prisutan ID u URL-u
const urlParams = new URLSearchParams(window.location.search);
currentInvoiceId = urlParams.get('id') ? parseInt(urlParams.get('id')) : null;

if (currentInvoiceId) {
    loadInvoice(currentInvoiceId);
}

// Funkcija za učitavanje računa
async function loadInvoice(id) {
    const invoice = await db.invoice.get(id); // Dohvati račun
    const items = await db.items.where({ invoiceId: id }).toArray(); // Dohvati stavke povezane s računom

    // Popuni podatke u formi
    document.querySelector(`input[name="vrstaDokumenta"][value="${invoice.type}"]`).checked = true;
    document.getElementById('datumRacuna').value = invoice.date;
    document.getElementById('vrijemeRacuna').value = invoice.time;
    document.getElementById('brojRacuna').value = invoice.invoiceNumber;
    document.getElementById('kupac').value = invoice.buyer;
    document.getElementById('adresa').value = invoice.adress;
    document.getElementById('OIB').value = invoice.oib;

    // Dodaj stavke u DOM
    items.forEach(addStavkaToDOM);
}
async function updateTotalPriceForInvoice(invoiceId) {
    // Dohvati sve stavke povezane sa računom
    const items = await db.items.where({ invoiceId: invoiceId }).toArray();

    // Izračunaj ukupnu cenu stavki
    const totalPriceWithoutPDV = items.reduce((sum, item) => sum + item.price * item.quantity, 0);

    // Dodaj PDV (25%)
    const totalPriceWithPDV = totalPriceWithoutPDV * 1.25;

    // Ažuriraj ukupnu cenu u računu
    await db.invoice.update(invoiceId, { totalPrice: totalPriceWithPDV.toFixed(2) });

    console.log(`Total price for invoice ${invoiceId} updated to: ${totalPriceWithPDV.toFixed(2)} €`);
}

// Funkcija za resetovanje računa i vraćanje na početnu stranicu
const spremiRacunButton = document.getElementById('spremiRacunButton');
spremiRacunButton.addEventListener('click', async () => {
    if (!currentInvoiceId) {
        alert('Ispuni sve podatke o računu/ponudi');
        return;
    }
    await updateTotalPriceForInvoice(currentInvoiceId);
    window.location.href = './index.html'; // Vrati korisnika na početnu stranicu
});
// Učitavanje stavki pri pokretanju
//loadStavke();
