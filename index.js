// Inicijalizacija baze
const db = new Dexie('PeroApp');
db.version(2).stores({
    items: '++id, name, quantity, unit, price, invoiceId', // Tabela za stavke
    invoice: '++id, type, date, time, invoiceNumber, buyer, adress, oib, totalPrice' // Tabela za račune
});

// Element za prikaz računa
const racuniLista = document.getElementById('racuniLista');

// Funkcija za učitavanje svih računa iz baze
async function loadInvoices() {
    const invoices = await db.invoice.toArray(); // Dohvati sve račune iz baze

    // Resetiraj listu računa
    racuniLista.innerHTML = '';

    invoices.forEach((invoice) => {
        const racunDiv = document.createElement('div');
        racunDiv.classList.add('racun');

        // Formatiraj datum u DD.MM.YYYY
        const formattedDate = formatDate(invoice.date);

        // Prikaži osnovne podatke o računu
        racunDiv.innerHTML = `
        <p><span style="font-weight: bold;">DATUM:</span> ${formattedDate}</p>
        <p><span style="font-weight: bold;">BROJ:</span> ${invoice.invoiceNumber}</p>
        <p><span style="font-weight: bold;">KUPAC:</span> ${invoice.buyer}</p>
        <p><span style="font-weight: bold;">CIJENA:</span> ${invoice.totalPrice} €</p>
        <div class="dvaButtona">
            <button class="openButton" data-id="${invoice.id}">Otvori</button>
            <button class="deleteButton" data-id="${invoice.id}">Obriši</button>
        </div>
    `;
    

        // Dodaj dugme za otvaranje
        racunDiv.querySelector('.openButton').addEventListener('click', () => {
            window.location.href = `./izrada.html?id=${invoice.id}`;
        });

        // Dodaj dugme za brisanje
        racunDiv.querySelector('.deleteButton').addEventListener('click', async (e) => {
            const id = parseInt(e.target.getAttribute('data-id'));
            await db.invoice.delete(id); // Obriši račun
            await db.items.where({ invoiceId: id }).delete(); // Obriši povezane stavke
            loadInvoices(); // Osvježi prikaz
        });

        // Dodaj u listu
        racuniLista.appendChild(racunDiv);
    });
}

// Funkcija za formatiranje datuma u DD.MM.YYYY
function formatDate(dateString) {
    const date = new Date(dateString);
    const day = String(date.getDate()).padStart(2, '0');
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const year = date.getFullYear();
    return `${day}.${month}.${year}`;
}

// Učitaj račune pri pokretanju stranice
loadInvoices();
