<div align="center">

# 🏛️ Projeto Minerva — Minerva Consulting
### *Inteligência e Análise de Dados no Ensino Superior*

![AWS](https://img.shields.io/badge/AWS-%23FF9900.svg?style=for-the-badge&logo=amazon-aws&logoColor=white)
![Docker](https://img.shields.io/badge/docker-%230db7ed.svg?style=for-the-badge&logo=docker&logoColor=white)
![Java](https://img.shields.io/badge/java-%23ED8B00.svg?style=for-the-badge&logo=openjdk&logoColor=white)
![MySQL](https://img.shields.io/badge/mysql-4479A1.svg?style=for-the-badge&logo=mysql&logoColor=white)
![Python](https://img.shields.io/badge/python-3776AB.svg?style=for-the-badge&logo=python&logoColor=white)

</div>

---

## 📌 Sobre o Projeto

O **Projeto Minerva** é uma plataforma de inteligência analítica desenvolvida para transformar dados brutos e complexos do **Censo da Educação Superior (INEP)** e dados socioeconômicos do **SEADE** em *insights* estratégicos para tomadores de decisão em Instituições de Ensino Superior (IES) e órgãos públicos do Estado de São Paulo.

A solução foca em responder duas perguntas fundamentais:
1. **Retenção:** *Onde e por que a instituição está perdendo alunos ao longo do ciclo acadêmico?*
2. **Expansão:** *Onde estão as oportunidades regionais e de EAD para abertura de novos cursos e turmas?*

---

## 👥 Grupo 06 — Pesquisa e Inovação

* **Gabrielle Fuchs**
* **Guilherme Camargo**
* **João Araújo**
* **Kauê Silva**
* **Lívia Faccin**
* **Matheus Maceu**

---

## 🚀 Funcionalidades da Plataforma

- **Landing Page Institucional:** Apresentação da solução e formulário público de contato.
- **Autenticação & Controle de Acesso (RBAC):** Sistema seguro de Login/Cadastro com perfil personalizado para diferentes níveis de acesso (Direção Executiva, Gerência de Marketing, Adm).
- **Ingestão Assíncrona de Dados:** Upload de planilhas `.xlsx` / `.xls` do INEP tratadas em segundo plano.
- **Dashboards Interativos (WebDataViz):**
  - Matriz de Risco (Volume de Matrículas vs. Taxa de Conclusão).
  - Funil de Retenção do Aluno (Vagas → Inscritos → Ingressantes → Matrículas → Concluintes).
  - Perfil Demográfico (Faixa Etária e Gênero).
  - Mapeamento Geográfico por Município e Região de SP.
- **Observabilidade & Alertas:** Registro de logs estruturados em tabela dedicada e integração com **AWS CloudWatch** + Notificações em tempo real via **Slack Webhook** e **JavaMail/Amazon SES**.

---

## 🏛️ Arquitetura de Solução

A aplicação segue o padrão **Client-Server em N-Camadas (Tier-3)** hospedada na nuvem **AWS**, combinando containers Docker e serviços gerenciados para garantir tempo de resposta em até **2,5 segundos** e disponibilidade de **99,5%**.

```text
[ CLIENTE / GESTOR ] ──(HTTPS)──> [ AWS CloudFront (CDN) ] ──> [ Amazon S3 (Frontend SPA) ]
                                                                      │
                                                           Requisições REST (JSON)
                                                                      │
                                                                      ▼
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│ INSTÂNCIA AWS EC2 (Linux Ubuntu)                                                        │
│                                                                                         │
│  ┌───────────────────────────────────────────────────────────────────────────────────┐  │
│  │ ECOSSISTEMA DOCKER                                                                │  │
│  │  ┌──────────────────────────────────────────┐   ┌──────────────────────────────┐  │  │
│  │  │ CONTAINER 1: BACKEND JAVA (API & ETL)    │   │ CONTAINER 2: SERVIÇO PYTHON  │  │  │
│  │  │  ├── Auth JWT & RBAC                     │   │  └── Geração de Relatórios   │  │  │
│  │  │  ├── Parsing Apache POI (.xlsx/.xls)     │   │      em PDF / DOC            │  │  │
│  │  │  ├── 3 CRUDs Web Persistidos             │   └──────────────────────────────┘  │  │
│  │  │  └── Log Service & Notificador           │                                     │  │
│  │  └────────────────────┬─────────────────────┘                                     │  │
│  └───────────────────────┼───────────────────────────────────────────────────────────┘  │
└──────────────────────────┼──────────────────────────────────────────────────────────────┘
                           │
       ┌───────────────────┼───────────────────┬───────────────────┐
       │ (Backup RAW)      │ (JDBC Queries)    │ (Logs)            │ (Alertas)
       ▼                   ▼                   ▼                   ▼
┌──────────────┐   ┌─────────────────┐   ┌─────────────────┐   ┌─────────────────┐
│  Amazon S3   │   │  MySQL RDS /    │   │ AWS CloudWatch  │   │ Slack Webhook / │
│  (Arquivos)  │   │  EC2 Database   │   │ & Tabela Log    │   │ JavaMail (SES)  │
└──────────────┘   └─────────────────┘   └─────────────────┘   └─────────────────┘
