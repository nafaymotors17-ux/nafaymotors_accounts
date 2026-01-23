import * as XLSX from "xlsx";
import { formatDate } from "./dateFormat";

/**
 * Export carriers to Excel
 * @param {Array} carriers - Array of carrier objects
 * @param {Object} filters - Filter parameters for filename
 * @param {boolean} isSuperAdmin - Whether user is super admin
 */
export function exportCarriersToExcel(carriers, filters = {}, isSuperAdmin = false) {
  if (carriers.length === 0) {
    throw new Error("No carriers to export");
  }

  // Prepare carrier data for Excel
  const carrierData = carriers.map((carrier, index) => {
    const profit = (carrier.totalAmount || 0) - (carrier.totalExpense || 0);
    return {
      "SR": index + 1,
      "Trip Number": carrier.tripNumber || carrier.name || "N/A",
      "Type": carrier.type === "company" ? "Company" : carrier.type === "trip" ? "Trip" : "N/A",
      "Date": formatDate(carrier.date),
      "Carrier Name": carrier.carrierName || "",
      "Driver Name": carrier.driverName || "",
      "Expense Details": carrier.details || "",
      "Notes": carrier.notes || "",
      "Status": carrier.isActive === false ? "Inactive" : "Active",
      "Cars Count": carrier.carCount || 0,
      "Total Amount": (carrier.totalAmount || 0).toFixed(2),
      "Total Expense": (carrier.totalExpense || 0).toFixed(2),
      "Profit": profit.toFixed(2),
      "User": isSuperAdmin && carrier.user?.username ? carrier.user.username : "N/A",
    };
  });

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Create carriers worksheet
  const carrierWs = XLSX.utils.json_to_sheet(carrierData);
  carrierWs["!cols"] = [
    { wch: 5 },   // SR
    { wch: 15 },  // Trip Number
    { wch: 10 },  // Type
    { wch: 12 },  // Date
    { wch: 15 },  // Carrier Name
    { wch: 15 },  // Driver Name
    { wch: 30 },  // Expense Details
    { wch: 30 },  // Notes
    { wch: 10 },  // Status
    { wch: 10 },  // Cars Count
    { wch: 15 },  // Total Amount
    { wch: 15 },  // Total Expense
    { wch: 15 },  // Profit
    { wch: 15 },  // User
  ];
  XLSX.utils.book_append_sheet(wb, carrierWs, "Carrier Trips");

  // Generate filename with filter info
  let filename = "Carrier_Trips";
  if (filters.startDate && filters.endDate) {
    filename += `_${filters.startDate}_to_${filters.endDate}`;
  }
  if (filters.company) {
    filename += `_${filters.company.replace(/[^a-zA-Z0-9]/g, "_")}`;
  }
  if (filters.isActive) {
    filename += `_${filters.isActive === "true" ? "Active" : "Inactive"}`;
  }
  filename += `_${new Date().toISOString().split("T")[0]}.xlsx`;

  // Save file
  XLSX.writeFile(wb, filename);
}

/**
 * Export cars to Excel
 * @param {Array} carriers - Array of carrier objects with cars
 * @param {Object} filters - Filter parameters for filename
 * @param {boolean} isSuperAdmin - Whether user is super admin
 */
export function exportCarsToExcel(carriers, filters = {}, isSuperAdmin = false) {
  // Prepare cars data - only include trip number from carrier
  const carsData = [];
  carriers.forEach((carrier) => {
    const cars = carrier.cars || [];
    if (cars.length > 0) {
      cars.forEach((car) => {
        carsData.push({
          "SR": carsData.length + 1,
          "Trip Number": carrier.tripNumber || carrier.name || "N/A",
          "Date": formatDate(car.date),
          "Stock No": car.stockNo || "",
          "Company": car.companyName || "",
          "Car Name": car.name || "",
          "Chassis": car.chassis || "",
          "Amount": (car.amount || 0).toFixed(2),
        });
      });
    }
  });

  if (carsData.length === 0) {
    throw new Error("No cars to export");
  }

  // Create workbook
  const wb = XLSX.utils.book_new();

  // Create cars worksheet
  const carsWs = XLSX.utils.json_to_sheet(carsData);
  carsWs["!cols"] = [
    { wch: 5 },   // SR
    { wch: 15 },  // Trip Number
    { wch: 12 },  // Date
    { wch: 12 },  // Stock No
    { wch: 20 },  // Company
    { wch: 20 },  // Car Name
    { wch: 20 },  // Chassis
    { wch: 15 },  // Amount
  ];
  XLSX.utils.book_append_sheet(wb, carsWs, "Cars");

  // Generate filename with filter info
  let filename = "Cars";
  if (filters.startDate && filters.endDate) {
    filename += `_${filters.startDate}_to_${filters.endDate}`;
  }
  if (filters.company) {
    filename += `_${filters.company.replace(/[^a-zA-Z0-9]/g, "_")}`;
  }
  if (filters.isActive) {
    filename += `_${filters.isActive === "true" ? "Active" : "Inactive"}`;
  }
  filename += `_${new Date().toISOString().split("T")[0]}.xlsx`;

  // Save file
  XLSX.writeFile(wb, filename);
}

/**
 * Export both carriers and cars to separate Excel files
 * @param {Array} carriers - Array of carrier objects with cars
 * @param {Object} filters - Filter parameters for filename
 * @param {boolean} isSuperAdmin - Whether user is super admin
 */
export function exportCarriersAndCars(carriers, filters = {}, isSuperAdmin = false) {
  try {
    exportCarriersToExcel(carriers, filters, isSuperAdmin);
    // Small delay to ensure first file is saved before second
    setTimeout(() => {
      exportCarsToExcel(carriers, filters, isSuperAdmin);
    }, 100);
  } catch (error) {
    throw error;
  }
}
