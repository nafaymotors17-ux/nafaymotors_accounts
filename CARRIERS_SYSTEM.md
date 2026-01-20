# Carriers System Documentation

## Overview

The Carriers system manages carrier trips containing multiple cars from different companies. Each car has a cost, and each carrier trip has total expenses. Profit is calculated as: **Total Car Amounts - Total Expenses**.

## Features

### 1. Carrier Trip Management
- Create new carrier trips with trip numbers and dates
- Track total expenses per trip
- View all trips with summary statistics

### 2. Car Management
- Add single or multiple cars to a trip at once
- Each car includes:
  - Stock Number
  - Date
  - Company Name (auto-created if doesn't exist)
  - Car Name/Model
  - Chassis Number
  - Amount (cost)
  - Customer (optional)

### 3. Company Management
- Companies are automatically created when adding cars
- Companies can be selected from existing list or typed to create new ones
- Filter cars by company

### 4. Filtering System
- Filter by date range (start date, end date)
- Filter by company name
- Filter by customer name
- Filters apply to both the main view and invoice generation

### 5. Invoice Generation
- Generate PDF invoices for carrier trips
- Options include:
  - Include all cars or filter by date/company/customer
  - Adjust total expense before generating
  - Save expense changes to carrier
- Invoice shows:
  - All car details (matching Excel format)
  - Total amount
  - Total expense
  - Profit calculation

## Database Models

### Company
- `name` (unique)
- `createdAt`, `updatedAt`

### Car
- `stockNo`
- `name` (car model)
- `chassis`
- `amount` (cost)
- `company` (reference to Company)
- `companyName` (denormalized for filtering)
- `carrier` (reference to Carrier)
- `date`
- `customer` (optional)

### Carrier
- `tripNumber` (unique)
- `date`
- `totalExpense`
- `notes` (optional)

## Usage

### Creating a Trip

1. Click "New Trip" button
2. Enter:
   - Trip Number (e.g., TRIP-001)
   - Date
   - Total Expense (can be updated later)
   - Notes (optional)
3. Click "Create Trip"

### Adding Cars to a Trip

1. Click "View Cars →" on a trip or click "Edit" then "Add Car(s)"
2. Choose mode:
   - **Single Car**: Add one car at a time
   - **Multiple Cars**: Add multiple cars in a table format
3. Fill in car details:
   - Stock No
   - Date
   - Company Name (type to create new or select existing)
   - Car Name/Model
   - Chassis
   - Amount
   - Customer (optional)
4. Click "Add Car(s)"

### Filtering Data

1. Click "Show Filters" in the Filters Panel
2. Set filters:
   - Date range
   - Company name
   - Customer name
3. Click "Apply Filters"
4. View filtered results with updated totals

### Generating Invoice

1. Click "Invoice" button on a carrier trip
2. Choose options:
   - Include all cars or apply filters
   - Adjust total expense if needed
   - Click "Save Expense" to update carrier expense
3. Review preview table
4. Click "Generate & Download PDF"

## File Structure

```
src/app/carriers/
├── page.js                          # Main carriers page
└── components/
    ├── FiltersPanel.js              # Filtering UI
    ├── CarriersTable.js              # Main table with trips
    ├── CarrierTripForm.js            # Create/edit trip form
    ├── CarsTable.js                  # Cars in a trip
    ├── CarForm.js                    # Add single/multiple cars
    └── InvoiceGenerator.js           # Invoice generation with PDF

src/app/lib/
├── models/
│   ├── Carrier.js                   # Carrier model
│   ├── Car.js                       # Car model
│   └── Company.js                   # Company model
└── carriers-actions/
    ├── carriers.js                  # Carrier CRUD actions
    ├── cars.js                      # Car CRUD actions
    └── companies.js                 # Company actions
```

## Key Features

### Automatic Company Creation
When adding a car with a company name that doesn't exist, the system automatically creates a new company. This makes data entry fast and seamless.

### Bulk Car Entry
The "Multiple Cars" mode allows adding many cars at once in a table format, perfect for importing data from Excel.

### Profit Calculation
Profit is automatically calculated as:
```
Profit = Sum of all car amounts - Total expense
```

### Flexible Filtering
Filters can be applied to:
- Main view (all trips and cars)
- Invoice generation (specific date ranges, companies, customers)

### Expense Management
- Set expense when creating trip
- Update expense via "Edit" button
- Adjust expense in invoice generator
- Save expense changes directly from invoice view

## Excel Format Compatibility

The system matches the Excel format shown:
- NO (row number)
- DATE
- STOCK NO
- COMPANY
- NAME (car model)
- CHASSIS
- AMOUNT
- CUSTOMER (optional)

All these fields are included in the invoice PDF.

## Next Steps

To extend the system:
1. Add more fields to cars (e.g., color, year)
2. Add customer management (separate model)
3. Add payment tracking
4. Add reports and analytics
5. Add export to Excel functionality
