# Nafay Motors Accounts — System Summary for Client

This document gives a high-level overview of how the system works, with a focus on **invoices**, **expenses**, and **truck maintenance tracking**.

---

## What the System Does

The system is a **transport / trucking accounts and operations** app. It helps you:

- Manage **trips** (carriers) and the **cars** moved on each trip  
- Issue **invoices** to client companies and track **payments**  
- Track **expenses** (fuel, maintenance, tyres, etc.) per **trip** and per **truck**  
- Track **truck maintenance** by mileage and get **warnings** when maintenance is due or overdue  

Users log in and see their own data; a super admin can see and manage everything.

---

## 1. Invoices

### How invoices are created

- Invoices are **built from trips and cars**. You choose a **date range** and optionally filter by company or active/inactive cars.  
- The system finds all **cars** delivered in that period (linked to **trips** and **trucks**), and you select which cars to include.  
- Each invoice gets a **unique number** (e.g. `INV-20250226-001`).  
- You enter: **client company**, **sender details**, **subtotal**, **VAT %**, **VAT amount**, **total**, and optional **descriptions**.  
- The invoice stores which **trips**, **trip dates**, and **truck numbers** it covers (for reference and reporting).

### What happens when you create an invoice

- The **total amount** of the invoice is added to that **client company’s “due” balance** (money they owe you).  
- The invoice starts as **unpaid**. You can then record payments against it.

### Payment tracking

- For each invoice you can **record one or more payments**: amount, date, method (e.g. Cash, Bank Transfer), and notes.  
- **Overpayments**: if the client pays more than the invoice balance, the extra is stored as **company credit** (for future use).  
- Invoice status is automatic: **Unpaid** → **Partial** (some payment) → **Paid** (fully covered).  
- When you record a payment, the company’s **total due** is reduced by the amount applied to the invoice; any excess increases their **credit balance**.

### Where you see invoices

- **Invoices** page: list, search, filter by company and payment status (paid/unpaid/partial), view totals.  
- **Companies** page: each company has **total due** (from unpaid/partial invoices) and **credit balance**. From a company you can open a **Payment history** view (invoices and payments for that company).

---

## 2. Expenses

Expenses are tracked in **two places**: per **trip** (carrier) and per **truck**. Both use the same expense types (categories).

### Expense categories

- **Fuel** — with optional liters and price per liter (amount can be auto-calculated)  
- **Driver rent** — payments to drivers (trip-level)  
- **Taxes / Tool taxes / On-road** — trip-related costs  
- **Maintenance** — truck servicing (with optional meter reading)  
- **Tyre** — tyre-related (with optional tyre number and info)  
- **Others** — any other cost  

Each expense has: **date**, **amount**, **category**, and optional **details** (and category-specific fields where applicable).

### Trip (carrier) expenses

- When you create or edit a **trip** (carrier), you can add **expenses** linked to that trip (e.g. fuel, driver rent, on-road).  
- These are “trip-level” costs for that delivery.  
- Trip expenses can be used in trip-level profit/cost views (e.g. on carrier-trips).

### Truck expenses

- Each **truck** has its own **expense list**.  
- You add expenses from the **truck detail** page: **Fuel**, **Maintenance**, **Tyre**, **Others**.  
- You can filter by **category** and **date range** and see **summaries** (e.g. total fuel, total maintenance) and a **paginated list** of expenses.  
- **Maintenance** and **tyre** expenses can store the **meter reading** at the time of the expense; for maintenance this is used to update the truck’s maintenance schedule (see below).

So: **invoices** bring in money from clients; **expenses** record what you spend (per trip and per truck).

---

## 3. Truck Maintenance Tracking

Maintenance is driven by **mileage (km)** and optional **maintenance history**.

### Per-truck settings

- **Current meter reading** — odometer (km) today.  
- **Maintenance interval** — e.g. every **1000 km** (configurable per truck).  
- **Last maintenance km** — odometer at last service.  
- **Last maintenance date** — when that service was done.

The system uses these to compute:

- **Next maintenance due at** = last maintenance km + maintenance interval  
- **Km remaining** = (next maintenance km) − (current meter reading)

### Status and warnings

- **OK** — more than 500 km until next maintenance.  
- **Due soon** — 500 km or less remaining (warning).  
- **Overdue** — current km is past the “next maintenance” km (strong warning).

On the **truck list** and **truck detail** page you see this status and, when relevant, a clear **maintenance due soon** or **maintenance overdue** message (with km and dates).

### How maintenance gets updated

- When you **add a truck expense** with category **Maintenance**, you can enter the **meter reading** at the time of service (or it can default from the truck’s current reading).  
- The system then:  
  - Updates the truck’s **last maintenance km** and **last maintenance date**  
  - Updates the truck’s **current meter reading** to that maintenance reading (so the “next due” is from that point)  
  - Appends a **maintenance history** entry (date, km, details, cost)  

So maintenance tracking stays in sync when you log real maintenance as an expense.

### Where you see it

- **Carriers (trucks)** list: each truck can show maintenance status (e.g. km remaining or overdue).  
- **Truck detail** page:  
  - Prominent **maintenance alert** (due soon / overdue) at the top  
  - **Expenses** table (filter by Maintenance)  
  - **Summary cards** (e.g. total maintenance spend)  
  - **Maintenance info** (last maintenance km/date, next due, history)

---

## Quick Reference

| Area              | Where in the app                    | Main idea                                                                 |
|-------------------|-------------------------------------|---------------------------------------------------------------------------|
| **Invoices**      | Invoices page, Companies page       | Create from trips/cars → record payments → company due/credit updated     |
| **Payments**      | On each invoice, Company statement  | Record payment (and optional excess → company credit)                     |
| **Expenses**      | Trip form, Truck detail page        | Log fuel, maintenance, tyre, etc. per trip or per truck                  |
| **Truck maintenance** | Carriers, Truck detail, Truck form | Set interval + last maintenance; add maintenance expense → system updates schedule and history |

---

## Summary in one paragraph

**Invoices** are created from delivered cars/trips, sent to client companies, and their **payments** are recorded; the system keeps each company’s **total due** and **credit** in sync. **Expenses** are logged either for a **trip** (carrier) or for a **truck** (fuel, maintenance, tyre, others). **Truck maintenance** is scheduled by km: you set the interval and last service; when you add a **maintenance expense** with a meter reading, the system updates “last maintenance” and **maintenance history**, and shows **due soon** or **overdue** warnings so you can plan the next service.
