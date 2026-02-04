# Truck Expense & Maintenance Tracking System - Implementation Summary

## Overview
A comprehensive expense and maintenance tracking system for trucks has been implemented. This system allows tracking expenses at the trip level, truck level, and automatically syncs fuel expenses from trips to trucks.

## Features Implemented

### 1. **Polymorphic Expense Model**
- Extended the Expense model to support multiple entity types:
  - `carrier` (trips/companies) - existing
  - `truck` - new
  - `driver` - new (for future use)
- Validation ensures exactly one reference is set
- Added `maintenance` category to expense types

### 2. **Truck Maintenance Tracking**
- Added maintenance history tracking to Truck model:
  - `lastMaintenanceKm` - KM reading at last maintenance
  - `lastMaintenanceDate` - Date of last maintenance
  - `maintenanceHistory[]` - Array of maintenance records with details and costs
- Automatic maintenance updates when maintenance expenses are added
- Maintenance alerts based on:
  - **Overdue**: When current KM exceeds next maintenance KM
  - **Due Soon**: When less than 500km remaining until next maintenance

### 3. **Trip Distance Tracking**
- Added `tripDistance` field to trip creation/editing
- When a trip is created/updated with a truck and distance:
  - Truck's `currentMeterReading` is incremented
  - Truck's `totalKms` is incremented
  - Maintenance status is checked and warnings logged

### 4. **Automatic Fuel Expense Sync**
- When a fuel expense is added to a trip:
  - The expense is automatically created for the truck as well
  - Truck expense includes reference to the source trip
  - Both expenses are linked but independent

### 5. **Truck Expense Management**
- **Truck Detail Page** (`/carriers/[truckId]`):
  - View all expenses for a truck
  - Add/edit/delete expenses
  - View maintenance status and alerts
  - View expense totals and summaries
  - See which expenses came from trips vs. direct truck expenses

- **Truck Expense API Routes**:
  - `GET /api/trucks/[truckId]/expenses` - List all expenses
  - `POST /api/trucks/[truckId]/expenses` - Create expense
  - `GET /api/trucks/[truckId]/expenses/[expenseId]` - Get expense
  - `PUT /api/trucks/[truckId]/expenses/[expenseId]` - Update expense
  - `DELETE /api/trucks/[truckId]/expenses/[expenseId]` - Delete expense

### 6. **UI Components**
- **TruckExpenseForm**: Reusable form component for adding/editing truck expenses
- **Truck Detail Page**: Complete expense tracking interface with:
  - Summary cards (Current KM, Total KM, Total Expenses, Next Maintenance)
  - Maintenance alerts (overdue/due soon)
  - Expense table with filtering and totals
  - Clickable truck names in TrucksTable to navigate to detail page

### 7. **Expense Categories for Trucks**
- `fuel` - Fuel expenses (with liters and price per liter)
- `maintenance` - Maintenance expenses (updates truck maintenance records)
- `taxes` - Tax expenses
- `tool_taxes` - Tool tax expenses
- `on_road` - On-road expenses
- `others` - Other expenses

## Database Changes

### Expense Model Updates
```javascript
{
  carrier: ObjectId (optional, for trips)
  truck: ObjectId (optional, for trucks)
  driver: ObjectId (optional, for drivers - future use)
  driverRentDriver: ObjectId (for driver rent expenses in trips)
  category: String (added "maintenance")
  // ... other fields
}
```

### Truck Model Updates
```javascript
{
  // ... existing fields
  lastMaintenanceDate: Date (new)
  maintenanceHistory: [{
    date: Date,
    kmReading: Number,
    details: String,
    cost: Number,
    createdAt: Date
  }] (new)
}
```

## API Endpoints

### New Endpoints
- `GET /api/trucks/[truckId]` - Get truck details
- `GET /api/trucks/[truckId]/expenses` - List truck expenses
- `POST /api/trucks/[truckId]/expenses` - Create truck expense
- `GET /api/trucks/[truckId]/expenses/[expenseId]` - Get expense
- `PUT /api/trucks/[truckId]/expenses/[expenseId]` - Update expense
- `DELETE /api/trucks/[truckId]/expenses/[expenseId]` - Delete expense

### Updated Endpoints
- `POST /api/carriers/[carrierId]/expenses` - Now auto-creates truck fuel expenses
- `POST /api/carriers` - Now handles `tripDistance` and updates truck meters
- `PUT /api/carriers/[carrierId]` - Now handles `tripDistance` and updates truck meters

## User Workflows

### Adding a Trip with Distance
1. Create/edit trip
2. Select truck
3. Enter trip distance (optional)
4. Save - truck meter is automatically updated
5. Maintenance status is checked

### Adding Fuel Expense to Trip
1. Open trip detail page
2. Click "Add Expense"
3. Select "Fuel" category
4. Enter fuel details (liters, price, etc.)
5. Save - expense is added to both trip AND truck automatically

### Adding Direct Truck Expense
1. Navigate to truck detail page (click truck name in trucks table)
2. Click "Add Expense"
3. Select category (fuel, maintenance, taxes, etc.)
4. Enter expense details
5. Save - expense is added to truck only

### Maintenance Tracking
1. When adding maintenance expense to truck:
   - Truck's `lastMaintenanceKm` is updated to current meter reading
   - `lastMaintenanceDate` is updated
   - Maintenance record is added to `maintenanceHistory`
2. Maintenance alerts show:
   - **Red alert**: Maintenance overdue (current KM > next maintenance KM)
   - **Yellow alert**: Maintenance due soon (< 500km remaining)
   - **Green**: All good

## Files Created/Modified

### New Files
- `src/app/carriers/[truckId]/page.js` - Truck detail page
- `src/app/carriers/components/TruckExpenseForm.js` - Expense form for trucks
- `src/app/api/trucks/[truckId]/route.js` - Truck detail API
- `src/app/api/trucks/[truckId]/expenses/route.js` - Truck expenses API
- `src/app/api/trucks/[truckId]/expenses/[expenseId]/route.js` - Truck expense CRUD API

### Modified Files
- `src/app/lib/models/Expense.js` - Added polymorphic references
- `src/app/lib/models/Truck.js` - Added maintenance tracking
- `src/app/lib/carriers-actions/carriers.js` - Added tripDistance handling
- `src/app/api/carriers/[carrierId]/expenses/route.js` - Auto-sync fuel expenses
- `src/app/carrier-trips/components/CarrierTripForm.js` - Added distance input
- `src/app/carrier-trips/components/ExpenseForm.js` - Updated driver field
- `src/app/carriers/components/TrucksTable.js` - Made truck names clickable
- `src/app/carrier-trips/[tripId]/page.js` - Updated driver field display

## Future Enhancements

1. **Driver Expense Tracking**: Implement expense tracking for drivers
2. **Maintenance Reminders**: Email/notification system for maintenance alerts
3. **Expense Reports**: Generate reports by date range, category, truck
4. **Fuel Efficiency Tracking**: Calculate and track fuel efficiency per truck
5. **Maintenance Scheduling**: Schedule future maintenance based on predicted usage

## Notes

- All existing trip expenses continue to work as before
- Truck expenses are independent - deleting a trip expense doesn't delete the truck expense
- Maintenance expenses automatically update truck maintenance records
- The system is backward compatible with existing data
