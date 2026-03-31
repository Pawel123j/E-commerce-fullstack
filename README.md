# ShopFlow Complete

Pełny starter full stack e-commerce zrobiony tak, żeby **odpalił się lokalnie bez Dockera**.

## Stack
- Frontend: React + TypeScript + Vite
- Backend: Express + TypeScript
- Baza: Prisma + SQLite
- Auth: JWT
- Stylowanie: własny CSS

## Co jest w środku
- rejestracja i logowanie
- katalog produktów
- wyszukiwarka, filtrowanie i sortowanie
- karta produktu
- koszyk w localStorage
- checkout i tworzenie zamówień
- historia zamówień użytkownika
- panel admina z listą produktów, statsami i formularzem dodawania
- seed z przykładowymi kategoriami, produktami, adminem i kuponem

## Dane testowe
### Admin
- email: `admin@shopflow.com`
- hasło: `Admin123!`

### Kupon
- kod: `WELCOME10`

## Jak odpalić na Windowsie
### 1. Backend
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$env:Path += ";C:\Program Files\nodejs"
cd C:\Users\Pawel\Downloads\shopflow-fullstack-complete\shopflow\server
copy .env.example .env
npm.cmd install
npx.cmd prisma generate
npx.cmd prisma db push
npm.cmd run seed
npm.cmd run dev
```

Backend wystartuje na `http://localhost:3000`.

### 2. Frontend
W drugim oknie PowerShell:
```powershell
Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass
$env:Path += ";C:\Program Files\nodejs"
cd C:\Users\Pawel\Downloads\shopflow-fullstack-complete\shopflow\client
copy .env.example .env
npm.cmd install
npm.cmd run dev
```

Frontend wystartuje na `http://localhost:5173`.

## Jak wejść do sklepu
- sklep: `http://localhost:5173`
- API health: `http://localhost:3000/api/health`

## Uwaga
Ten projekt używa **SQLite**, więc nie potrzebujesz Dockera ani Postgresa do startu.
Jak będziesz chciał, możesz potem przepiąć Prisma na Postgresa.
