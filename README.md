# ShopFlow

Pełny sklep internetowy full stack, który uruchamia się lokalnie **bez Dockera
i bez zewnętrznej bazy** — Prisma na SQLite.

![CI](https://github.com/Pawel123j/E-commerce-fullstack/actions/workflows/ci.yml/badge.svg)

## Stack

| Warstwa | Technologia |
|---|---|
| Frontend | React 19, TypeScript, Vite |
| Backend | Express, TypeScript |
| Baza | Prisma ORM + SQLite |
| Uwierzytelnianie | JWT (`jsonwebtoken`) + bcrypt |
| Walidacja | Zod na granicy API |
| Testy | Vitest + supertest — 37 testów API; Node test + JSDOM — 29 regresji providerów klienta |

## Co jest w środku

- rejestracja i logowanie (hasła hashowane bcryptem)
- role `USER` / `ADMIN` z osobnym middleware `adminOnly`
- katalog produktów, wyszukiwarka, filtrowanie i sortowanie
- karta produktu, koszyk w `localStorage`
- checkout: walidacja stanów magazynowych, kupony procentowe i kwotowe
  z progiem minimalnej wartości, zamówienie z pozycjami w transakcji
- historia zamówień użytkownika
- panel administratora: statystyki, lista produktów, dodawanie, lista zamówień
- seed z kategoriami, produktami, administratorem i kuponem

### Model danych

Sześć encji w [`server/prisma/schema.prisma`](server/prisma/schema.prisma):
`User`, `Category`, `Product`, `Coupon`, `Order`, `OrderItem` — z enumami
`Role` i `CouponType`, relacjami i unikalnymi slugami.

## Zrzuty ekranu

Zrzuty z działającej lokalnie aplikacji (dane z `npm run seed` plus jedno
zamówienie złożone przez API z kuponem `WELCOME10`).

**Historia zamówień klienta:** pozycje, ceny i suma po rabacie (787 zł − 10% = 708,30 zł).

![Historia zamówień](docs/screenshots/account-orders.png)

**Panel administratora:** statystyki, formularz dodawania produktu, stany
magazynowe i ostatnie zamówienia. Stany Orbit Keyboard (9 → 8) i Glow Desk
Lamp (24 → 22) są już po checkoutcie: zamówienie zdejmuje towar z magazynu
w tej samej transakcji.

![Panel administratora](docs/screenshots/admin-dashboard.png)

> Widoków z grafiką produktów (strona główna, katalog, karta produktu, koszyk)
> tu nie ma. Zdjęcia ładują się z `images.unsplash.com`, a środowisko, w którym
> robiono zrzuty, blokowało ten host. Zamiast wstawiać podmienione obrazki,
> pomijam te widoki.

## Uruchomienie

Wymagany Node 24 LTS (co najmniej 24.15). Polecenia są takie same na Linuksie, macOS i Windows
(PowerShell) — jedyną różnicą jest sposób kopiowania pliku `.env`.

### 1. Backend

```bash
cd server
cp .env.example .env          # Windows PowerShell: copy .env.example .env
```

Otwórz `server/.env` i ustaw `JWT_SECRET`. **Serwer odmówi startu bez niego** —
nie ma wartości domyślnej, bo sekret zapisany w kodzie jest publiczny razem
z repozytorium. Wygeneruj własny:

```bash
node -e "console.log(require('crypto').randomBytes(48).toString('base64url'))"
```

Następnie:

```bash
npm install
npx prisma generate
npx prisma migrate deploy
npm run seed
npm run dev
```

Backend wystartuje na `http://localhost:3000`.

### 2. Frontend

W drugim terminalu:

```bash
cd client
cp .env.example .env          # Windows PowerShell: copy .env.example .env
npm install
npm run dev
```

Frontend wystartuje na `http://localhost:5173`.

## Dane testowe

Tworzone przez `npm run seed`:

| Co | Wartość |
|---|---|
| Administrator | `admin@shopflow.com` / `Admin123!` |
| Kupon | `WELCOME10` |

> Konto administratora jest celowo znane — to dane demonstracyjne w bazie
> SQLite tworzonej lokalnie, nie poświadczenia do czegokolwiek wystawionego na
> zewnątrz. Sekret podpisujący tokeny (`JWT_SECRET`) to osobna sprawa i **nie
> jest** w repozytorium.

## API

| Metoda | Ścieżka | Dostęp |
|---|---|---|
| `GET` | `/api/health` | publiczny |
| `POST` | `/api/auth/register` | publiczny |
| `POST` | `/api/auth/login` | publiczny |
| `GET` | `/api/auth/me` | zalogowany |
| `GET` | `/api/categories` | publiczny |
| `GET` | `/api/products` | publiczny (filtry w query) |
| `GET` | `/api/products/:slug` | publiczny |
| `GET` | `/api/coupons/:code` | publiczny |
| `POST` | `/api/orders` | zalogowany |
| `GET` | `/api/orders/my` | zalogowany |
| `GET` | `/api/admin/stats` | **admin** |
| `GET` | `/api/admin/products` | **admin** |
| `POST` | `/api/admin/products` | **admin** |
| `GET` | `/api/admin/orders` | **admin** |

## Testy

```bash
cd server
npm test
```

34 testy przez supertest, na osobnej bazie SQLite w katalogu tymczasowym —
nie dotykają `dev.db`. Pokrywają rejestrację i logowanie, odrzucanie
podrobionych tokenów, **granicę roli administratora** (zalogowany ≠ uprawniony),
walidację stanów magazynowych, naliczanie kuponu i izolację historii zamówień
między użytkownikami.

## Zależności i bezpieczeństwo

`npm audit` zwraca **0 podatności** w obu pakietach. Żeby to osiągnąć, w
`server/package.json` jest blok `overrides`:

| Paczka | Wymuszona wersja | Dlaczego |
|---|---|---|
| `effect` | `^3.20.0` | zależność CLI Prismy; GHSA-38f7-945m-qr2g |
| `deepmerge-ts` | `^8.0.0` | zależność CLI Prismy; GHSA-ggr8-5vv4-36mx |
| `qs` | `^6.16.0` | Express 4 przypina `~6.14.0`; GHSA-4mjr-xmp4-gh2g |
| `esbuild` | `^0.28.1` | `tsx` przypina `~0.27.0`; GHSA-g7r4-m6w7-qqqr |

Te nadpisania podnoszą paczki **ponad zakresy deklarowane przez ich
rodziców** — czyli robią coś, czego npm sam nie zrobi. Dlatego nie zostały
przyjęte na słowo: po każdym z nich sprawdzone zostały `prisma generate`,
`prisma db push`, seed przez `tsx`, kompilacja TypeScriptu i pełny zestaw
32 testów. Wszystko przechodzi.

Naturalne rozwiązanie docelowe to Prisma 8 i Express 5, które nie potrzebują
już tych nadpisań. Prisma 8 jest na dzień pisania dopiero w wersji
`8.0.0-rc`, a przejście na Express 5 to zmiana łamiąca — oba są do zrobienia
świadomie, a nie przy okazji `npm audit fix`.

CI blokuje merge przy podatności o poziomie `high` lub wyższym.

## Znane ograniczenia

- **Brak bramki płatniczej.** Checkout tworzy zamówienie, ale niczego nie
  pobiera — to demo logiki sklepu, nie integracja z operatorem płatności.
- **SQLite.** Wystarcza lokalnie; przepięcie na PostgreSQL to zmiana
  `provider` w `schema.prisma` i `DATABASE_URL`.
- **Token w `localStorage`** po stronie klienta — wygodne, ale podatne na XSS.
  Docelowo ciasteczko `httpOnly`.

## Licencja

MIT — patrz [LICENSE](LICENSE).

## Aktualna walidacja i ograniczenia

Prisma 6.19.2 generuje klienta z oficjalnych binariów. Schemat nowej bazy
instaluje wersjonowana migracja `202610170001_initial`; `migrate deploy`
można uruchamiać ponownie bez utraty danych. Dla istniejącej bazy utworzonej
przez `db push` najpierw wykonaj kopię i porównaj schemat, a dopiero po
potwierdzeniu zgodności zastosuj standardowy baselining Prismy. Nie resetuj
bazy zawierającej dane. Seed jest destrukcyjny i służy wyłącznie do demo.

Rezerwacja magazynu używa warunkowego atomowego decrementu w transakcji.
Regresja uruchamia dwa zakupy ostatniej sztuki i wymaga tylko jednego sukcesu.
Odrzucone obietnice handlerów Express trafiają do wspólnej obsługi błędów;
API nie zwraca szczegółów bazy. Koszyk wylicza rabat z potwierdzonego kuponu
z API, w tym kwotowego, i usuwa go po zmianie kodu.

Sprawdzenia: 34 testy API, generowanie klienta, kompilacja backendu i
frontendu oraz rzeczywisty checkout w Chromium na izolowanej SQLite.
Backend nadal wymaga własnego `JWT_SECRET`; testy używają wyłącznie
publicznej wartości testowej we własnej bazie. W tym środowisku chmurowym
polecenia Prismy wymagają `RUST_LOG=info` ze względu na odziedziczony filtr
logowania Rust. Nie wpływa to na TLS ani sumy kontrolne.

### Test przeglądarkowy

Po instalacji zależności obu pakietów i zbudowaniu backendu:

```bash
cd client
VITE_API_URL=http://127.0.0.1:18311/api npm run build
cd ..
python -m pip install -r e2e/requirements.txt
python -m playwright install chromium
python -m pytest -q e2e
```

Test sam tworzy i usuwa bazę tymczasową, uruchamia API i frontend, rejestruje
klienta, sprawdza kupon kwotowy i trwałość zamówienia po reload. Nie używa
mocka API. `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` opcjonalnie wskazuje
zainstalowane Chromium. CI wykonuje ten sam scenariusz i zachowuje wyniki.

Gotowość: lokalne demo i build produkcyjny zweryfikowane. Płatności są
symulowane (status PAID nie oznacza obciążenia karty). Publikacja, TLS
reverse proxy, ochrona loginu przed brute force, kopie/odtwarzanie i monitoring
nie są zweryfikowane; aplikacja nie jest jeszcze sklepem produkcyjnym.
Rollback wdrożenia wymaga poprzedniego artefaktu aplikacji i zgodnej kopii
bazy; nie cofaj migracji przez reset bazy.


### Testy przeglądarkowe

Po zainstalowaniu zależności aplikacji i zbudowaniu frontendu zgodnie z README / workflow `browser.yml` (lub jobem browser w `ci.yml`):

```bash
python -m venv .venv-e2e
# Aktywuj ten venv przed dalszymi poleceniami.
python -m pip install -r e2e/requirements.txt
python -m playwright install chromium
python -m pytest -q e2e
```

Na Linux może być potrzebne `python -m playwright install --with-deps chromium` z uprawnieniami administratora. Alternatywnie `PLAYWRIGHT_CHROMIUM_EXECUTABLE_PATH` wskazuje istniejący Chromium. Testy uruchamiają i zatrzymują własny serwer, używają nowego kontekstu przeglądarki i zapisują logi w ignorowanym `e2e/artifacts/`. Pełny backend musi mieć zainstalowane swoje zależności; `E2E_API_PYTHON` jest opcjonalnym wyborem jego interpretera w AutoDesk/BankGuard. Testy nie uruchamiają wdrożenia.

## Aktualizacja zależności 2026-10-17

Zaktualizowano m.in. `proxy-addr` do 2.0.8 i `source-map-js` do 1.2.2. Audyt npm obu pakietów klient/serwer zwrócił zero zgłoszeń w tym przebiegu. Ponownie zaliczono 34 testy API, generowanie Prisma, oba buildy i checkout w Chromium. To nie zastępuje audytu infrastruktury ani konfiguracji JWT. Weryfikacja E2E klienta wymaga `VITE_API_URL=http://127.0.0.1:18311/api`; standardowe wdrożenie buduj ponownie z adresem docelowego API.

## Walidacja etapu 2 — 2026-10-18

API ogranicza rejestrację do 10 prób na godzinę, a nieudane logowania do 20 na 15 minut na adres klienta; odpowiedź 429 zawiera informację o ponowieniu. Nie ufa przekazanym przez klienta nagłówkom X-Forwarded-For. Liczniki są w pamięci pojedynczego procesu — wiele instancji wymaga wspólnego magazynu i jawnej konfiguracji zaufanych proxy.

37 testów API obejmuje konkurencję stock oraz limitowanie/wygaśnięcie limitu. E2E na nowej bazie wykonuje migracje dwukrotnie, rejestrację, rzeczywisty kupon, checkout i reload zamówienia; axe sprawdza rejestrację, koszyk i konto. Pola ilości mają dostępne nazwy. Czyste instalacje, oba buildy i audit 0 potwierdzono lokalnie. Płatność pozostaje demonstracyjna; nie przeprowadzono rzeczywistego obciążenia konta ani wdrożenia.

## Odporność koszyka i sesji — 2026-10-25

Koszyk sprawdza strukturę odczytanych produktów, ceny, całkowite ilości i sumy.
Uszkodzony zapis pozostaje pod dotychczasowym kluczem `shopflow_cart`; aplikacja
nie zastępuje go automatycznie pustym koszykiem. Gdy odczyt lub zapis przeglądarki
jest niedostępny, widoczny komunikat informuje o pracy wyłącznie w bieżącej karcie.
Zmiany takiego koszyka nie przetrwają przeładowania; poprzedni zapis zostaje
zachowany do odzyskania. Zwykły zapis działa po poprawnym odczycie i zmianie koszyka.

Logowanie może działać w pamięci mimo zablokowanego storage. Żądania API używają
aktualnej sesji, a nie starego tokenu pozostawionego przez nieudany zapis.
Jeżeli przeglądarka odmawia usunięcia tokenu przy wylogowaniu, aplikacja kończy
sesję tej karty i ostrzega, że zapisane logowanie może powrócić po przeładowaniu.
Przed udostępnieniem urządzenia należy wtedy wyczyścić dane tej witryny w ustawieniach
przeglądarki. Spóźniona odpowiedź API nie przywraca sesji zakończonej przez użytkownika.
Zmiana logowania w innej karcie kończy lokalną sesję zamiast cicho podmieniać konto.

Regresje działają bez prawdziwej przeglądarki i bez serwera API:

```bash
cd client
npm ci
npm test
npm run typecheck
npm run build
npm audit --audit-level=high
```

29 testów wykonuje rzeczywiste providery React, interceptor Axios oraz komunikaty
aplikacji w JSDOM. Adapter HTTP i storage są kontrolowane przez testy; ten wynik
nie zastępuje checkout E2E z prawdziwym API. Czyste `npm ci`, testy, kontrola typów,
build i audit klienta (0 zgłoszeń) zweryfikowano 25.10.2026. Zaktualizowane drzewo
klienta zawiera Vite 6.4.5 oraz poprawione `follow-redirects`; poprzednie wyniki
bezpieczeństwa w starszych sekcjach opisują wyłącznie ich daty wykonania.
