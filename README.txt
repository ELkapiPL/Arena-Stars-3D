ARENA STARS 3D — ONLINE SOLO + RANKING TOP 200
================================================

CO DZIAŁA
- Każdy gracz rozgrywa własny, osobny mecz solo.
- Gracze NIE pojawiają się na tej samej arenie i nie grają wspólnie.
- Serwer zapisuje dowolną liczbę prawdziwych profili.
- Tabela w lobby, po prawej stronie, pokazuje 200 najlepszych wyników.
- Jeśli jesteś poza TOP 200, nad tabelą nadal zobaczysz swoje dokładne miejsce.
- W rankingu nie ma komputerowych graczy ani sztucznych wpisów.
- Ranking odświeża się automatycznie co około 1,5 sekundy.

URUCHOMIENIE NA WINDOWS
1. Zainstaluj Python 3, jeśli nie jest zainstalowany.
2. Kliknij URUCHOM_ONLINE.bat.
3. Gra otworzy się pod adresem http://localhost:8000

URUCHOMIENIE NA LINUX / macOS
1. Otwórz terminal w folderze gry.
2. Wykonaj: ./URUCHOM_ONLINE.sh
3. Otwórz http://localhost:8000

INNI GRACZE W TEJ SAMEJ SIECI
- Po uruchomieniu serwer wypisze adres podobny do http://192.168.1.20:8000
- Inne osoby w tym samym Wi-Fi/LAN mogą otworzyć ten adres.

PRAWDZIWY INTERNET
- Serwer musi działać na publicznym hostingu lub komputerze z przekierowanym portem 8000.
- Dołączony Dockerfile pozwala wdrożyć grę na hostingu obsługującym kontenery.
- Samo otwarcie index.html bez server.py nie uruchamia rankingu online.

DANE
- Profile są zapisywane w pliku players.json.
- Nie usuwaj tego pliku, jeśli chcesz zachować ranking.
- Lokalny postęp gracza jest dodatkowo przechowywany w pamięci przeglądarki.

UWAGA O PROTOTYPIE
- To lekki prototyp. Wynik jest wysyłany przez klienta, więc publiczny serwer wymagałby dodatkowych zabezpieczeń przeciw oszukiwaniu.
