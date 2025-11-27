# 🧠 Daily Scrum – Hovedopgave

---

## 📋 Kladde
## 📅 Daily Scrum 11-11-2025

### Hvad har vi lavet siden sidst?
### Hvad skal vi lave i dag?
### Hvilke udfordringer forudser vi?

---

## 📅 Daily Scrum 11-11-2025

### Hvad har vi lavet siden sidst?
- Fastlagt os på hovedopgave sammen med Klaus og Søren  
- Læst op på Elasticsearch  
- Sat Medusa-projektet op  
- Lavet en minimal plan for forløbet  
- Blevet enige i gruppen omkring struktur og mødetider for projektforløbet  

### Hvad skal vi lave i dag?
- Gruppekontrakt  
- Problemformulering / problemstilling  
- Aftale vejledning med Ian  
- Diskutere Elasticsearch og blive enige om implementering  
- Lave et udkast til et ER-diagram / Domænemodel  

### Hvilke udfordringer forudser vi?
- Minimal erfaring med Elasticsearch – hvor skal vi starte, og hvordan skal vi gribe problemet an?

## Daily Scrum 13-11-2025
### Hvad har vi lavet siden sidst?
 - Sat ElasticSearch op i en Docker container og integreret det i vores docker-compose
 - Lavet en Makefile for at gøre vores arbejde nemmere
 - Sat en præmatur CI-pipeline op med sonarcloud og sonarqube
 - Vektorudregner, som gemmer alle produkter som vektorer i en ekstra tabel. 
 - Sat User stories ind i GitHub projects
 - Lavet en knowledge sharing mappe under vores docs
 - Gemt raw plantuml 
 - Rollback igennem Medusa worklows
 - Endpoints til at kunne teste det i postman
 - Gruppekontrakt
 - User stories
 - BullMQ - køsystem. 
 - Tilføjet Elasticsearch 
 - BullMQ skal køres hver gang et produkt opdateres, slettes, laves. 
 - Vi skal gemme vektorer et sted - i Elasticsearch
### Hvad skal vi lave i dag?
 - Gennemgå kode i forhold til vektor embedding
 - Få merget og samlet vores individuelle arbejde så vi sikre at vi kører ud af samme spor
 - Opsætning af Redis i en Docker container
 - Fælles AGENTS.md fil
### Hvilke udfordringer forudser vi?
 - Mulig problem med ES i Docker container for windows brugere, med den nuværende implementering
 - Mergekonflikt


## 📅 Daily Scrum 14-11-2025

### Hvad har vi lavet siden sidst?
 - Opsat Python miljø I en docker container
 - Forbundet vores workflow til embedding i Node.js med dette Python miljø
 - Skrevet en embedder i Python
 - Samlet de to branches 
 - Opsætning a BullMQ
 - Opsætning af embedding til Elasticsearch
### Hvad skal vi lave i dag?
 - Prøve at få systemet til at køre mere smooth (vi har lige nu 5-6 services, computerne har svært ved at følge med). 
 - Lave lidt flere produkter, eventuelt Klaus' script?
 - Teste om vores embedder faktisk laver semantiske værdier der ligger tæt på hinanden når de burde
 - Lav backend til søgefunktionalitet
 - Eventuelt frontend til at se denne søgefunktionalitet i praksis
 - Hvis automatiserede tests, sætte disse ind i en CI-pipeline
 - AGENTS.md file
### Hvilke udfordringer forudser vi?
 - Hvordan opsætter man tests i Python?

## 📅 Daily Scrum 17-11-2025

### Hvad har vi lavet siden sidst?
 - Lavet lidt flere produkter - script med hjælp af faker
 - Skrevet tests på eksisterende workflows, og oprettet CI pipeline til disse
 - Tests af vores python miljø
 - Optimering af python miljø
 - Opsætning af search API endpoint
 - Minimalt UI til søgefunktionalitet i Next.js storefront
 - AGENTS.md fil
### Hvad skal vi lave i dag?
 - Teste om alt virker
 - Få søgefunktionaliteten til at spille sammen med den nye embededing (768 parametre)
 - Møde med Søren og Klaus
 - Eventuelt BM25 søgning implementeret
 - Risikoanalyse
 - Interessentanalyse
### Hvilke udfordringer forudser vi?


## 📅 Daily Scrum 18-11-2025

### Hvad har vi lavet siden sidst?
 -  Opsatte embedding til OpenAI
 - BM25 search, kombineret med vores vektorsøgning
 - Fuzzy search
 - Fix af CI pipeline
 - Fix af søgning, der ikke fungerede når man navigerede til et produkt
### Hvad skal vi lave i dag?
 - Møde med Ian
 - Fuzzy implementering færdiggjort
 - Risikoanalyse
 - Interessentanalyse
 - Kigge vores kode igennem, forstå den ordentligt, og finde steder hvor der kan refaktoreres
 - Forstå BullMQ ordentligt
 - Finde ud af hvordan vi vil monitorere og visualisere performance analyse i vores system
 - Prøve at få Redis og Postgres op at køre remote, for at spare performance på vores lokale enheder
### Hvilke udfordringer forudser vi?
 - Hvordan måler vi vores fuzzy/BM25 implementering? 

### Noter fra møde med Ian

 - Sustainability som et muligt afsnit
 - I forlængelse af dette sovereignty
 - God ide med Deployment - opvej hvad gør Alpha vs Hvordan vi får mest fingrene i det
 - Dokumenter GitHub i rapporten inklusiv yaml filer til issue_templates og argumenter hvorfor vi har valgt dem
 - Teknologivalg - hvorfor? Valg fra Alpha Solutions eller 
 - Ændrede objekt struktur i Python, dette medførte at det ikke længerede passede med strukturen i Medusa Backend - Dette blev opdaget manuelt
 - Vi skal have skrevet en test der ville opfange dette i en CI-pipeline istedet
 - Forhold os til læringsmålene inden vi påbegynder skrivning
 - Få påbegyndt rapportskrivning allerede nu

## 📅 Daily Scrum 19-11-2025

### Hvad har vi lavet siden sidst?
 - Risikoanalyse
 - Interessentanalyse
 - Møde med Ian
 - Metrics op at køre
 - Refaktoreret til korrekt Medusa module struktur
 - Karl kigget på monitorering generelt
 - Anders har implementeret Fuzzy search
 - Implementeret confidence level, så søgemaskinen ikke altid responderer med et svar
 - Fixet searchbar UI
### Hvad skal vi lave i dag?
 - Refaktoreret vores routes
 - Refaktoreret elasticsearch module service
 - Gennemgå PR til metrics
 - Fordele hvad vi skal skrive om torsdag/fredag
 - Udkast til rapportstruktur
### Hvilke udfordringer forudser vi?
 - Eventuelle merge konflikter


## 📅 Daily Scrum 24-11-2025

### Hvad har vi lavet siden sidst?
 - Begyndt rapportskrivning
 - Refaktoreret routes
 - Refaktoreret elasticsearch module service
 - Merged metrics PR
 - Fixet SonarQube delvist
### Hvad skal vi lave i dag?
 - Møde med Søren
 - Få SonarQube til at spille 100%
 - Arbejde videre på metrics
 - Kigge på bugs i backloggen
 - Integrere vektorlogik til anbefalede produkter
 - Kig på det vi har skrevet i fællesskab, og blive enige om konventioner fremadrettet, struktur, detaljegrad, kilder, layout. 
 - Lav test og testdata til analyse af embedder, så vi kan lave denne analyse om valg af dimensions versus performance. 
### Hvilke udfordringer forudser vi?
 - Hvilke metrikker skal vi måle på, og hvordan skal vi visualisere dem?
 - Fixe product script så den giver god data
 - Aleksander skal finde ud af hvorfor fanden hans VScode laver .2 filer



## Møde med Søren 24-11/2025
 - Søgning skal kunne ske over forskellige kategorier, pris, størrelse etc. 
 - Valg af en kategori skal ikke udelukke en anden, men udelukke dead ends
 - Researche hvordan man gør dette i ElasticSearch
 - UI udvide søgefelt/lave til en modal
 - Deploye
 - Få monitorering helt op at køre
 - Bedre og ensrettet produktdata
 - Et par modeller mere til Embedding analyse
 - 
 ## 📅 Daily Scrum 11-11-2025

### Hvad har vi lavet siden sidst?
 - Fået Grafana op at køre.
 - Sat Terraform op til at provisione VM.
 - Dashboard med embedding tests i Python.
 - Lavet karussel til anbefalede produkter og integreret vektorlogik i denne. 
 - Coderabbit kører nu kun med label på PR
 - Fordelt et par emner mere vi hver især skal skrive om. 
### Hvad skal vi lave i dag?
 - Få Ansible op at køre, og deploye vores backend
 - Merget både Python og Terraform ind i dev
 - Sikre at alle stadig kan køre programmet
 - Arbejder på filterfunktion til søgning
 - Overveje hvad der ellers skal vises på Grafana
 - Få strømlinet produkter - brug Klaus' template og udfyld med 150 produkter
### Hvilke udfordringer forudser vi?
 - Forstå filtrering i Elastic
 - Ansible driller


 ## 📅 Daily Scrum 27-11-2025

### Hvad har vi lavet siden sidst?
 - Lavet et nyt endpoint til reccomendations
 - Sat Terraform op til at provisione vores VM
 - Sat Ansible op til at lave mappestruktur og installere docker og docker compose på vores VM
 - Lavet CD workflow til automatisk deployment
 - Deployet vores database på Neon
 - Filtrering af produkter i vores søgning
 - Lavet produkt script med god reel data
### Hvad skal vi lave i dag?
 - Få Medusa til at virke i Docker på VM
 - Finpudset modal til filtrering
 - Ryddet op i endpoint til reccomendations
 - Refaktorere modal komponenter
 - Spise burger og flødeboller
 - Deployet til Vercel
### Hvilke udfordringer forudser vi?
 - Hvorfor Medusa ikke vil køre på vores VM, fordi den mangler en tom fil!?!
