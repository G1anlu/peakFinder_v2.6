# PeakFinder v2.5 — ricostruzione fedele dell'app

Ricreo nel nuovo progetto l'app del repository `peakFinder_v2.5`, mantenendo struttura, schermate, dati e comportamento. Il progetto originale usa la stessa tecnologia di questo, quindi la copia può essere molto fedele.

## Cosa conterrà l'app

**Pagine**
- Home con benvenuto, selezione comprensori e notizie
- Esplora (elenco e scheda singola località)
- Crea itinerario e pagina itinerario con mappa, meteo, impianti, piste, hotel, noleggi, parcheggi
- Risultati della ricerca comprensori con punteggio e confronto
- Profilo: identità, preferiti, amici, itinerari salvati, cancellazione account
- Sfida PvP: arena, duello, punteggio GPS, monete, classifica Elo
- Accesso, registrazione, recupero password
- Privacy, termini, cookie policy con banner consensi

**Funzioni**
- Punteggio comprensori basato su meteo, neve, qualità, stagione, prezzi
- Preferiti, amicizie, notifiche, itinerari salvati
- Mappe e mappa impianti in tempo reale
- Notizie ordinate dalla più recente
- Dati inclusi: elenco comprensori italiani, indice impianti, notizie

## Backend

Attivo Lovable Cloud e ricreo il database dell'originale con le sue 8 migrazioni: profili, preferiti, amicizie, itinerari, cache comprensori/hotel, noleggi, funzioni di supporto, tabelle e logica PvP (countdown, pareggio, abbandono, pulizia partite ferme), bonus impianti e aggiornamenti in tempo reale, con regole di accesso per utente.

Accesso con email e password, link magico e recupero password; il profilo viene creato automaticamente alla registrazione.

## Servizi esterni

Alcune funzioni richiedono chiavi che non sono nel repository pubblico e che dovrai fornire quando vorrai attivarle:
- LocationIQ — ricerca luoghi e geocodifica
- RapidAPI — hotel
- Windy — webcam
- codici partner dei network di noleggio (nel repository c'è un valore segnaposto)

Senza queste chiavi tutto il resto funziona; le sezioni collegate mostrano dati assenti o segnaposto.

## Dettagli tecnici

- Copio i file sorgente dal repository (componenti `src/components/ski` e `ui`, hook, librerie `src/lib/ski`, dati JSON, rotte TanStack, server functions e route API `api/hotels/rapidapi`, `api/itineraries`, `api/locationiq/nearby`), adattando solo l'integrazione Supabase alla nuova istanza Cloud.
- Allineo le dipendenze del `package.json` originale (leaflet, embla, recharts, react-day-picker, qrcode, capacitor geolocation, zod, ecc.).
- Porto `src/styles.css` con il design system dell'originale.
- Applico le migrazioni SQL `0000`–`0007` in ordine, con GRANT e RLS.
- Metadati head per ogni pagina e service worker `public/sw.js` come nell'originale.

## Verifica

Build senza errori e controllo delle pagine principali (home, esplora, crea itinerario, risultati, accesso, profilo, località, privacy) nell'anteprima.
