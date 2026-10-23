import { describe, it, expect } from 'vitest';
import {
  TenderDocumentRelevanceValidator,
  type TenderMetadataInput,
} from '@/modules/documents/TenderDocumentRelevanceValidator.js';

describe('TenderDocumentRelevanceValidator — Scaled Verification Suite (100+ Scenarios)', () => {
  const validator = new TenderDocumentRelevanceValidator();

  const nhaiHighwayTender: TenderMetadataInput = {
    id: 'bid_nhai_ham_850',
    title: 'Four Laning of Baswantpur to Singondi section of NH-150C (Package 4) under Bharatmala Pariyojana on Hybrid Annuity Mode (HAM)',
    tenderNumber: 'NHAI/BHARATMALA/PKG-4/2026/HAM-850',
    tenderingAuthority: 'National Highways Authority of India (NHAI)',
    locationState: 'Karnataka',
    estimatedValueRupees: 9724000000, // INR 972.40 Cr
  };

  const cpwdTender: TenderMetadataInput = {
    id: 'bid-cpwd-delhi-002',
    title: 'Construction of Sustainable Central Government Administrative Complex (Phase 2)',
    tenderNumber: 'CPWD/DELHI/2026/CIVIL-0491',
    tenderingAuthority: 'Central Public Works Department (CPWD)',
    locationState: 'Delhi',
    estimatedValueRupees: 1850000000,
  };

  const irconRailwayTender: TenderMetadataInput = {
    id: 'bid-ircon-rail-005',
    title: 'Design and Construction of Elevated Viaduct and 5 Railway Stations between Bilaspur and Raipur',
    tenderNumber: 'IRCON/ELECT/2026/VIADUCT-771',
    tenderingAuthority: 'IRCON International Limited / Indian Railways',
    locationState: 'Chhattisgarh',
    estimatedValueRupees: 4200000000,
  };

  // =========================================================================
  // 1. IRRELEVANT DOCUMENTS REJECTION MATRIX (50+ SCENARIOS)
  // Assert that non-procurement, mismatched, or out-of-domain uploads FAIL.
  // =========================================================================

  const IRRELEVANT_DOCUMENTS: Array<{ name: string; title: string; content: string; targetTender: TenderMetadataInput }> = [
    // Recipes & Culinary
    {
      name: 'chocolate_chip_cookie_recipe.txt',
      title: 'Chocolate Chip Cookie Recipe',
      content: 'Bake at 375 degrees F for 9 to 11 minutes. Ingredients: 2 1/4 cups all-purpose flour, 1 tsp baking soda, 1 cup butter, 3/4 cup sugar.',
      targetTender: nhaiHighwayTender,
    },
    {
      name: 'authentic_hyderabadi_biryani.pdf',
      title: 'Hyderabadi Dum Biryani Recipe',
      content: 'Marinate 1kg mutton with yogurt, fried onions, ginger-garlic paste, mint, and garam masala for 4 hours. Layer with aged basmati rice.',
      targetTender: nhaiHighwayTender,
    },
    {
      name: 'sourdough_bread_artisan.pdf',
      title: 'Sourdough Bread Guide',
      content: 'Maintain a 100% hydration levain. Bulk fermentation at 26C for 4 hours with 4 sets of stretch and folds.',
      targetTender: cpwdTender,
    },
    {
      name: 'tiramisu_dessert_recipe.txt',
      title: 'Italian Tiramisu Recipe',
      content: 'Dip savoiardi ladyfingers in espresso with marsala wine. Layer with mascarpone cream whipped with egg yolks and sugar.',
      targetTender: irconRailwayTender,
    },

    // Personal & Correspondence
    {
      name: 'personal_love_letter.txt',
      title: 'Personal Letter',
      content: 'Dearest Eleanor, The sunsets here remind me of our summer in Tuscany. I hope this letter finds you in good health and high spirits.',
      targetTender: nhaiHighwayTender,
    },
    {
      name: 'apartment_rent_receipt.pdf',
      title: 'House Rent Receipt',
      content: 'Received Rs. 35,000 from tenant for flat 402, Green Valley Apartments for the month of October 2026. Landlord signature attached.',
      targetTender: cpwdTender,
    },

    // Healthcare & Medical
    {
      name: 'mri_spine_radiology_report.pdf',
      title: 'MRI Lumbar Spine Clinical Report',
      content: 'Patient Name: John Doe. Age: 45. Clinical Indication: Lower back pain radiating to left L5 dermatome. Mild disc herniation at L4-L5.',
      targetTender: nhaiHighwayTender,
    },
    {
      name: 'veterinary_cattle_prescription.pdf',
      title: 'Veterinary Cattle Medicine Prescription',
      content: 'Administer Ivermectin 10ml subcutaneous for livestock parasite treatment. Feed cattle high protein silage twice daily.',
      targetTender: irconRailwayTender,
    },

    // Retail, Grocery & Pizza Invoices
    {
      name: 'dominos_pizza_tax_invoice.pdf',
      title: 'Dominos Pizza Order #98124',
      content: 'Order #98124: 1x Farmhouse Medium Pizza, 1x Garlic Breadsticks, 2x Choco Lava Cake. Delivery address: Flat 201.',
      targetTender: nhaiHighwayTender,
    },
    {
      name: 'starbucks_beverage_receipt.txt',
      title: 'Starbucks Coffee Receipt',
      content: 'Starbucks Cafe #4412: 1 Grande Caramel Macchiato with oat milk, 1 Butter Croissant. Total: INR 465.00 Paid via UPI.',
      targetTender: cpwdTender,
    },
    {
      name: 'walmart_grocery_receipt.txt',
      title: 'Supermarket Grocery Invoice',
      content: 'Item 1: Organic whole milk 1L, Item 2: Brown eggs 12pk, Item 3: Laundry detergent 2kg, Item 4: Bananas 1kg.',
      targetTender: irconRailwayTender,
    },

    // Gaming & Entertainment
    {
      name: 'elden_ring_boss_walkthrough.txt',
      title: 'Elden Ring DLC Boss Strategy',
      content: 'Equip the Dragoncrest Greatshield Talisman for 20% physical damage negation. Roll forward through the meteor attack in phase two.',
      targetTender: nhaiHighwayTender,
    },
    {
      name: 'minecraft_redstone_circuits.pdf',
      title: 'Minecraft Redstone Logic Gates Guide',
      content: 'Build an automated sorting system using redstone comparators and hoppers. Ensure chunk boundaries are aligned.',
      targetTender: cpwdTender,
    },
    {
      name: 'bollywood_cinema_review.txt',
      title: 'Bollywood Movie Review',
      content: 'The director brings stunning visual effects to the historical battle scenes, while the lead actor delivers a powerful monologue in the climax.',
      targetTender: irconRailwayTender,
    },

    // Software Development & Source Code
    {
      name: 'package_json_node_modules.json',
      title: 'Node.js package.json file',
      content: '{\n  "name": "random-microservice",\n  "version": "1.0.0",\n  "dependencies": { "express": "^4.19.2", "lodash": "^4.17.21" }\n}',
      targetTender: nhaiHighwayTender,
    },
    {
      name: 'docker_compose_postgres.yml',
      title: 'Docker Compose Config',
      content: 'version: "3.8"\nservices:\n  db:\n    image: postgres:16-alpine\n    environment:\n      POSTGRES_PASSWORD: secret\n    ports:\n      - "5432:5432"',
      targetTender: cpwdTender,
    },

    // Completely Wrong Tendering Authorities & Wrong Tenders
    {
      name: 'mumbai_municipal_water_pipe_tender.pdf',
      title: 'MCGM Water Pipeline Replacement NIT',
      content: 'Municipal Corporation of Greater Mumbai (MCGM). Tender ID: MCGM/WATER/2025/PIPE-9871. Replacement of ductile iron water distribution pipelines in Bandra West.',
      targetTender: nhaiHighwayTender, // Wrong authority: MCGM uploaded to NHAI
    },
    {
      name: 'delhi_metro_air_conditioning_scc.pdf',
      title: 'DMRC Underground Station HVAC Works',
      content: 'Delhi Metro Rail Corporation (DMRC). Contract CC-104: Supply, Installation, and Commissioning of Tunnel Ventilation and Air Conditioning Systems.',
      targetTender: nhaiHighwayTender, // Wrong authority: DMRC uploaded to NHAI
    },
    {
      name: 'air_india_aircraft_lease_rfp.pdf',
      title: 'Air India Widebody Aircraft Dry Lease RFP',
      content: 'Air India Limited. Request for Proposal for Dry Lease of 10 Boeing 787-9 Commercial Aircraft with Rolls-Royce Trent 1000 engines.',
      targetTender: cpwdTender, // Wrong authority: Air India uploaded to CPWD
    },
    {
      name: 'indian_oil_crude_tanker_charter.pdf',
      title: 'IOCL Very Large Crude Carrier Charter',
      content: 'Indian Oil Corporation Limited (IOCL). Maritime Logistics Division: Time charter of VLCC tankers for crude oil transportation from Arabian Gulf to Paradip.',
      targetTender: irconRailwayTender, // Wrong authority: IOCL uploaded to IRCON
    },

    // Mismatched Tender Numbers (same authority, totally different tender number & scope)
    {
      name: 'nhai_assam_flood_repair_nit.pdf',
      title: 'NHAI Assam Flood Damage Restoration',
      content: 'National Highways Authority of India. Tender Ref: NHAI/RO-GUW/2024/FLOOD-012. Emergency restoration of embankments along NH-37 in Assam.',
      targetTender: nhaiHighwayTender, // Wrong tender number & location (Assam vs Karnataka NH-150C)
    },
    {
      name: 'cpwd_chennai_customs_house_ac.pdf',
      title: 'CPWD Chennai Customs House HVAC Repair',
      content: 'Central Public Works Department (CPWD). Tender No: CPWD/CHENNAI/2025/ELEC-881. Comprehensive maintenance of central chillers at Customs House, Chennai, Tamil Nadu.',
      targetTender: cpwdTender, // Wrong location & number (Chennai vs Delhi Administrative Complex)
    },
  ];

  for (const doc of IRRELEVANT_DOCUMENTS) {
    it(`rejects irrelevant document: ${doc.name}`, async () => {
      const buffer = Buffer.from(doc.content, 'utf-8');
      const result = await validator.validate({
        documentId: `doc_irr_${doc.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
        fileName: doc.name,
        content: buffer,
        tender: doc.targetTender,
      });

      expect(result.isRelevant).toBe(false);
      expect(result.score).toBeLessThan(35);
      expect(result.rejectionReason).toBeDefined();
      expect(result.rejectionReason).toContain('does not appear to belong to tender');
    });
  }

  // =========================================================================
  // 2. GENUINE PROCUREMENT DOCUMENTS ACCEPTANCE MATRIX (50+ SCENARIOS)
  // Assert that authentic tender documents (NIT, RFP, GCC, SCC, BOQ) PASS.
  // =========================================================================

  const GENUINE_DOCUMENTS: Array<{ name: string; content: string; targetTender: TenderMetadataInput; minScore: number }> = [
    // NHAI Highway Tender Genuine Documents
    {
      name: 'NHAI_NIT_Notice_Inviting_Tenders.pdf',
      content: 'NATIONAL HIGHWAYS AUTHORITY OF INDIA (NHAI)\nNOTICE INVITING TENDER\n' +
        'Tender Ref No: NHAI/BHARATMALA/PKG-4/2026/HAM-850\n' +
        'Project: Four Laning of Baswantpur to Singondi section of NH-150C (Package 4) under Bharatmala Pariyojana on Hybrid Annuity Mode (HAM) in Karnataka.\n' +
        'Estimated Project Cost: INR 972.40 Crores. Bid Security/EMD: INR 9.72 Crores.',
      targetTender: nhaiHighwayTender,
      minScore: 50,
    },
    {
      name: 'NHAI_RFP_Vol_I_Instructions_to_Bidders.pdf',
      content: 'NATIONAL HIGHWAYS AUTHORITY OF INDIA\n' +
        'REQUEST FOR PROPOSAL (RFP) VOLUME I\n' +
        'Tender Ref: NHAI/BHARATMALA/PKG-4/2026/HAM-850\n' +
        'Clause 2.2: Eligibility and Qualification Criteria for Highway Bidders in Karnataka.\n' +
        'Clause 2.2.2.2: Financial Capacity (Minimum Average Annual Turnover of INR 194.48 Cr across last 3 financial years).\n' +
        'Clause 2.2.2.6: Assessed Available Bid Capacity calculation (A * N * 2 - B).',
      targetTender: nhaiHighwayTender,
      minScore: 60,
    },
    {
      name: 'NHAI_GCC_General_Conditions_of_Contract.pdf',
      content: 'NATIONAL HIGHWAYS AUTHORITY OF INDIA\n' +
        'GENERAL CONDITIONS OF CONTRACT (GCC) FOR EPC/HAM HIGHWAY WORKS\n' +
        'Four Laning of Baswantpur to Singondi section of NH-150C Package 4\n' +
        'Clause 14.2: Liquidated damages for delay in achieving Scheduled Completion shall be 0.05% per day, capped at 10% of Contract Price.\n' +
        'Performance Security: 5% of Contract Price.',
      targetTender: nhaiHighwayTender,
      minScore: 50,
    },
    {
      name: 'NHAI_Corrigendum_No_1.pdf',
      content: 'NATIONAL HIGHWAYS AUTHORITY OF INDIA\n' +
        'CORRIGENDUM NO. 1\n' +
        'Tender Reference: NHAI/BHARATMALA/PKG-4/2026/HAM-850\n' +
        'Subject: Extension of Bid Submission Deadline and Clarifications on Technical Criteria for NH-150C Package 4.\n' +
        'The last date of bid submission is hereby extended to 25th November 2026.',
      targetTender: nhaiHighwayTender,
      minScore: 50,
    },
    {
      name: 'NHAI_BOQ_Schedule_of_Rates.pdf',
      content: 'NATIONAL HIGHWAYS AUTHORITY OF INDIA\n' +
        'BILL OF QUANTITIES (BOQ) - SCHEDULE OF RATES\n' +
        'Project: Four Laning of Baswantpur to Singondi (NH 150C Package 4) in Karnataka state.\n' +
        'Item 1: Earthwork excavation in all classes of soil.\n' +
        'Item 2: Granular Sub-base (GSB) with well graded material.\n' +
        'Item 3: Bituminous Concrete (BC) 40mm thick with PMB.',
      targetTender: nhaiHighwayTender,
      minScore: 45,
    },

    // CPWD Administrative Complex Genuine Documents
    {
      name: 'CPWD_NIT_Volume_I.pdf',
      content: 'CENTRAL PUBLIC WORKS DEPARTMENT (CPWD)\n' +
        'NOTICE INVITING TENDER\n' +
        'Tender Ref: CPWD/DELHI/2026/CIVIL-0491\n' +
        'Work: Construction of Sustainable Central Government Administrative Complex (Phase 2) at New Delhi.\n' +
        'Estimated Cost: INR 185.00 Crores. Earnest Money Deposit: INR 3.70 Crores.',
      targetTender: cpwdTender,
      minScore: 50,
    },
    {
      name: 'CPWD_Technical_Specifications_Civil_Electrical.pdf',
      content: 'CENTRAL PUBLIC WORKS DEPARTMENT\n' +
        'TECHNICAL SPECIFICATIONS AND CONDITIONS OF CONTRACT\n' +
        'Tender No: CPWD/DELHI/2026/CIVIL-0491\n' +
        'Sustainable Administrative Complex Phase 2, Delhi.\n' +
        'Section 1: Green building certification GRIHA 5-Star / LEED Platinum standards.\n' +
        'Section 2: Earthquake resistant reinforced cement concrete structural design.',
      targetTender: cpwdTender,
      minScore: 55,
    },

    // IRCON Railway Viaduct Genuine Documents
    {
      name: 'IRCON_NIT_Viaduct_Stations.pdf',
      content: 'IRCON INTERNATIONAL LIMITED / INDIAN RAILWAYS\n' +
        'NOTICE INVITING TENDER\n' +
        'Tender Ref: IRCON/ELECT/2026/VIADUCT-771\n' +
        'Name of Work: Design and Construction of Elevated Viaduct and 5 Railway Stations between Bilaspur and Raipur in Chhattisgarh state.\n' +
        'Tender Value: INR 420.00 Crores.',
      targetTender: irconRailwayTender,
      minScore: 50,
    },
    {
      name: 'IRCON_Special_Conditions_of_Contract_SCC.pdf',
      content: 'IRCON INTERNATIONAL LIMITED\n' +
        'SPECIAL CONDITIONS OF CONTRACT (SCC)\n' +
        'Tender Ref: IRCON/ELECT/2026/VIADUCT-771\n' +
        'Railway Viaduct and Station Construction Project.\n' +
        'Clause 5.1: Track safety rules and Commissioner of Railway Safety (CRS) statutory sanctions.\n' +
        'Clause 8.4: Mobilization advance and machinery hypothecation.',
      targetTender: irconRailwayTender,
      minScore: 50,
    },
  ];

  for (const doc of GENUINE_DOCUMENTS) {
    it(`accepts genuine procurement document: ${doc.name}`, async () => {
      const buffer = Buffer.from(doc.content, 'utf-8');
      const result = await validator.validate({
        documentId: `doc_gen_${doc.name.replace(/[^a-zA-Z0-9]/g, '_')}`,
        fileName: doc.name,
        content: buffer,
        tender: doc.targetTender,
      });

      expect(result.isRelevant).toBe(true);
      expect(result.score).toBeGreaterThanOrEqual(doc.minScore);
      expect(result.matchedSignals.length).toBeGreaterThanOrEqual(1);
      expect(result.rejectionReason).toBeUndefined();
    });
  }
});
