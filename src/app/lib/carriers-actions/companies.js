"use server";

import { revalidatePath } from "next/cache";
import mongoose from "mongoose";
import connectDB from "@/app/lib/dbConnect";
import Carrier from "@/app/lib/models/Carrier";
import { getSession } from "@/app/lib/auth/getSession";
import Company from "@/app/lib/models/Company";

// Companies are now carriers with type='company'
// For backward compatibility, also include carriers that have name but no tripNumber
// Also check old Company collection if it exists
export async function getAllCompanies() {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { companies: [] };
    }

    const allCompanies = [];
    
    // Convert userId to ObjectId if it's a valid string (for proper query matching)
    let targetUserId = session.userId;
    if (mongoose.Types.ObjectId.isValid(targetUserId)) {
      targetUserId = new mongoose.Types.ObjectId(targetUserId);
    } else {
      return { companies: [] };
    }
    
    // Build query for Carrier companies - filter by userId if not super admin
    // Only get companies (type='company'), NOT trips (type='trip')
    const carrierQuery = {
      type: 'company', // Explicitly only get companies, not trips
      name: { $exists: true, $ne: null, $ne: '' }, // Must have a name
      userId: { $exists: true, $ne: null } // Must have userId
    };

    // Filter by userId if user is not super admin
    if (session.role !== "super_admin") {
      carrierQuery.userId = targetUserId;
    }
    
    // 1. Get companies from Carrier collection (only type='company', not trips)
    let carrierQueryWithPopulate = Carrier.find(carrierQuery).sort({ name: 1 });
    
    // Populate user info for admin users
    if (session.role === "super_admin") {
      carrierQueryWithPopulate = carrierQueryWithPopulate.populate('userId', 'username role');
    }
    
    const carrierCompanies = await carrierQueryWithPopulate.lean();
    
    allCompanies.push(...carrierCompanies);
    
    // 2. Get companies from Company model (for invoice senders with full details)
    try {
      const CompanyModule = await import("@/app/lib/models/Company");
      const Company = CompanyModule.default;
      
      if (Company) {
        // Build query for Company model - filter by userId if not super admin
        const companyQuery = {
          userId: { $exists: true, $ne: null } // Must have userId
        };
        if (session.role !== "super_admin") {
          companyQuery.userId = targetUserId;
        }

        let companyModelQuery = Company.find(companyQuery).sort({ name: 1 });
        
        // Populate user info for admin users
        if (session.role === "super_admin") {
          companyModelQuery = companyModelQuery.populate('userId', 'username role');
        }
        
        const companyModelCompanies = await companyModelQuery.lean();
        
        // Include full company details (for invoice senders)
        const converted = companyModelCompanies.map(company => ({
          _id: company._id,
          name: company.name,
          companyName: company.companyName || company.name,
          address: company.address || "",
          taxId: company.taxId || "",
          isInvoiceSender: company.isInvoiceSender || false,
          type: 'company',
          userId: company.userId,
          user: company.userId && typeof company.userId === 'object' ? {
            _id: company.userId._id,
            username: company.userId.username,
            role: company.userId.role
          } : null,
          createdAt: company.createdAt,
          updatedAt: company.updatedAt
        }));
        
        allCompanies.push(...converted);
      }
    } catch (e) {
      // Company collection doesn't exist or can't be queried - that's okay
    }
    
    // Remove duplicates based on name (case-insensitive)
    const uniqueCompanies = [];
    const seenNames = new Set();
    
    for (const company of allCompanies) {
      const nameKey = (company.name || '').toUpperCase();
      if (nameKey && !seenNames.has(nameKey)) {
        seenNames.add(nameKey);
        uniqueCompanies.push(company);
      }
    }
    
    // Ensure _id is properly serialized and include user info for admin
    const serialized = uniqueCompanies.map(company => {
      const serializedCompany = {
        ...company,
        _id: company._id?.toString() || company._id
      };
      
      // Include user info if populated (for admin users)
      if (company.userId && typeof company.userId === 'object' && company.userId.username) {
        serializedCompany.user = {
          _id: company.userId._id?.toString() || company.userId._id,
          username: company.userId.username,
          role: company.userId.role
        };
      } else if (company.user) {
        // Already has user info from Company model
        serializedCompany.user = {
          ...company.user,
          _id: company.user._id?.toString() || company.user._id
        };
      }
      
      return serializedCompany;
    });
    
    return {
      companies: JSON.parse(JSON.stringify(serialized)),
    };
  } catch (error) {
    return { companies: [] };
  }
}

export async function createCompany(name, targetUserId = null) {
  await connectDB();
  try {
    const session = await getSession();
    if (!session) {
      return { error: "Unauthorized" };
    }

    const trimmedName = name.trim().toUpperCase();
    
    if (!trimmedName) {
      return { error: "Company name is required" };
    }
    
    // Use provided userId or default to session userId
    let finalUserId = targetUserId || session.userId;
    if (mongoose.Types.ObjectId.isValid(finalUserId)) {
      finalUserId = new mongoose.Types.ObjectId(finalUserId);
    }
    
  
    // Check if company name already exists globally (not per user)
    const existingCompany = await Company.findOne({ 
      name: trimmedName
    });
    if (existingCompany) {
      return { error: "Company with this name already exists" };
    }
    
const company = await new Company({
  name: trimmedName,
  userId: finalUserId,
}).save();

    revalidatePath("/carrier-trips");
    return {
      success: true,
      company: JSON.parse(JSON.stringify(company))
    };
  } catch (error) {
    console.error("Error creating company:", error);
    if (error.code === 11000) {
      return { error: "Company with this name already exists" };
    }
    return { error: "Failed to create company" };
  }
}

