#!/usr/bin/env python3
"""
Generate the exact real GeM and Indian Railways tender PDFs provided by the user.
Creates valid multi-page PDF documents in the samples/ folder.
"""

import os

def build_pdf_stream(text_lines):
    stream_content = "BT\n/F1 10 Tf\n13 TL\n40 760 Td\n"
    for line in text_lines:
        # Normalize non-latin1 characters
        line_clean = (
            line.replace("—", "--")
            .replace("–", "-")
            .replace("₹", "Rs. ")
            .replace("“", "\"")
            .replace("”", "\"")
            .replace("’", "'")
        )
        if line_clean.startswith("# "):
            stream_content += f"/F1 14 Tf ({line_clean[2:]}) Tj T*\n/F1 10 Tf\n"
        elif line_clean.startswith("## "):
            stream_content += f"/F1 11 Tf ({line_clean[3:]}) Tj T*\n/F1 10 Tf\n"
        elif line_clean == "":
            stream_content += "T*\n"
        else:
            escaped = line_clean.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            # Truncate lines that might overflow PDF width
            if len(escaped) > 105:
                escaped = escaped[:105]
            stream_content += f"({escaped}) Tj T*\n"
    stream_content += "ET\n"
    return stream_content

def generate_pdf(output_path, pages_text_list):
    objects = []
    
    # 1. Catalog
    objects.append("<< /Type /Catalog /Pages 2 0 R >>")
    
    # 2. Pages object
    page_count = len(pages_text_list)
    page_refs = " ".join([f"{3 + i * 2} 0 R" for i in range(page_count)])
    objects.append(f"<< /Type /Pages /Kids [ {page_refs} ] /Count {page_count} >>")
    
    for i, page_lines in enumerate(pages_text_list):
        page_obj_id = 3 + i * 2
        content_obj_id = 4 + i * 2
        
        # Page object
        page_obj = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> "
            f"/Contents {content_obj_id} 0 R >>"
        )
        objects.append(page_obj)
        
        # Content stream object
        stream_data = build_pdf_stream(page_lines)
        stream_len = len(stream_data.encode("latin1"))
        content_obj = f"<< /Length {stream_len} >>\nstream\n{stream_data}endstream"
        objects.append(content_obj)
    
    # Write PDF file
    os.makedirs(os.path.dirname(output_path), exist_ok=True)
    with open(output_path, "wb") as f:
        f.write(b"%PDF-1.4\n%\xe2\xe3\xcf\xd3\n")
        offsets = []
        for i, obj_str in enumerate(objects):
            offsets.append(f.tell())
            f.write(f"{i + 1} 0 obj\n{obj_str}\nendobj\n\n".encode("latin1"))
        
        xref_offset = f.tell()
        f.write(f"xref\n0 {len(objects) + 1}\n".encode("latin1"))
        f.write(b"0000000000 65535 f \n")
        for offset in offsets:
            f.write(f"{offset:010d} 00000 n \n".encode("latin1"))
        
        trailer = (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        )
        f.write(trailer.encode("latin1"))

def main():
    samples_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "samples"))
    
    # Document 1: Real GeM Global Tender (AIIMS Raipur - High End Surgical Microscope)
    gem_pages = [
        # Page 1
        [
            "# GOVERNMENT E-MARKETPLACE (GeM) -- GLOBAL TENDER DOCUMENT",
            "Bid Number: GEM/2026/B/8008666 | Dated: 23-09-2026",
            "This Global Tender Bid is governed by General Terms and Conditions of Global Tender.",
            "",
            "## BID DETAILS",
            "Bid End Date/Time: 07-10-2026 15:00:00",
            "Bid Opening Date/Time: 08-10-2026 15:00:00",
            "Bid Offer Validity (From End Date): 180 (Days)",
            "Ministry/State Name: Ministry Of Health And Family Welfare",
            "Department Name: Department Of Health And Family Welfare",
            "Organisation Name: All India Institute Of Medical Sciences (AIIMS)",
            "Office Name: Raipur",
            "Item Category: GlobalTenderCategory (Q3)",
            "Global Tender Title: High End Surgical Microscope",
            "Minimum Average Annual Turnover of Bidder (For 3 Years): 40 Lakh (s)",
            "OEM Average Turnover (Last 3 Years): 160 Lakh (s)",
            "Years of Past Experience Required for same/similar service: 3 Year (s)",
            "MSE Relaxation for Years Of Experience and Turnover: Yes | Complete",
            "Startup Relaxation for Years Of Experience and Turnover: Yes | Complete",
        ],
        # Page 2
        [
            "## DOCUMENT & BID EVALUATION REQUIREMENTS",
            "Documents Required from Seller: Experience Criteria, Past Performance, Bidder Turnover,",
            "                                Certificate (Requested in ATC), OEM Authorization Certificate, OEM Annual Turnover.",
            "Past Performance: 50%",
            "Allowed Terms of Delivery: Within 120 days from date of receipt of Purchase Order on DDP basis.",
            "Payment Terms: 70% of contract value released upon successful delivery at consignee site and submission",
            "               of required documents. Remaining 30% released after successful installation, commissioning,",
            "               and acceptance of equipment by user department.",
            "Time allowed for Technical Clarifications during technical evaluation: 2 Days",
            "Evaluation Method: Total value wise evaluation",
            "Financial Document Required: Yes",
            "Arbitration Clause: No | Mediation Clause: No",
        ],
        # Page 3
        [
            "## EMD & PERFORMANCE SECURITY (ePBG) DETAILS",
            "Advisory Bank: Bank of India",
            "EMD Amount: INR 251340 (Two Lakh Fifty-One Thousand Three Hundred Forty Rupees)",
            "ePBG Percentage: 5.00%",
            "Duration of ePBG Required: 26 Months",
            "EMD Exemption: Under MSE category, only manufacturers for goods and service providers are eligible.",
            "Beneficiary: Executive Director, AIIMS Raipur, Ministry of Health and Family Welfare",
            "",
            "## MAKE IN INDIA (MII) PURCHASE PREFERENCE",
            "MII Purchase Preference: Yes",
            "Purchase Preference to MII sellers available upto price within: L1 + 20%",
            "Maximum Percentage of Bid quantity for MII purchase preference: 50%",
        ],
        # Page 4
        [
            "## STATUTORY PURCHASE PREFERENCES & TURNOVER CRITERIA",
            "MII Order 2017: Allow participation only from Class 1/Class 2 local suppliers (DPIIT Order 16.09.2020).",
            "MSE Purchase Preference: Yes (Price preference L1 + 15%, Max quantity 25%).",
            "",
            "1. DPIIT Startup Relaxation: Relaxed from Experience and Turnover criteria subject to meeting quality.",
            "2. Turnover Verification: Certified Audited Balance Sheets or CA Certificate with UDIN required.",
            "3. Past Experience: Bidder or OEM must have supplied same/similar products to Central/State Govt/PSU.",
            "4. OEM Turnover: Minimum average annual turnover of OEM during last 3 years must be Rs. 160 Lakhs.",
        ],
        # Page 5
        [
            "## BUYER ADDED BID SPECIFIC TERMS AND CONDITIONS (ATC)",
            "1. Experience Certificate: Supply order and completion certificate for Govt/PSU/renowned private hospital.",
            "2. MSME / NSIC: EMD exemption certificate must be enclosed.",
            "3. Make in India: Specific authorization certificate required.",
            "4. OPTION CLAUSE: Purchaser reserves the right to increase or decrease quantity by up to 50 percent.",
            "5. IMPORTED PRODUCTS: OEM or Authorized Seller must have a registered office in India for service support.",
            "6. Forms of EMD/PBG: FDR pledged in favor of AIIMS Raipur is permitted.",
        ],
        # Page 6
        [
            "## SERVICE, WARRANTY AND PRE-BID MEETING",
            "7. Service & Support: Bidder/OEM must have a Functional Service Centre in Chhattisgarh State.",
            "   If not present, must establish within 30 days of award.",
            "8. Pre-Bid Meeting: Conducted on 15.09.2026 at 03:30 PM at Store Office, New Admin Block, AIIMS Raipur.",
            "9. Hard copy submission: Indemnity Bond, Integrity Pact, and EMD must reach AIIMS within 5 days of bid.",
            "10. Warranty: 2 years comprehensive warranty from final acceptance with on-site breakdown rectification.",
        ],
        # Page 7
        [
            "## DISCLAIMER & CODE OF INTEGRITY",
            "1. Publishing custom/BOQ bids for items available in standard catalog is prohibited.",
            "2. Mandating specific brand/model without PAC approval is prohibited.",
            "3. Labor Codes Compliance: All sellers must ensure full compliance with Code on Wages 2019,",
            "   Industrial Relations Code 2020, OSHWC Code 2020, and Social Security Code 2020.",
        ],
        # Page 8
        [
            "## LAND BORDER RESTRICTIONS & UNDERTAKING",
            "GeM GTC Clause 26: Restrictions on procurement from bidders of countries sharing land borders with India.",
            "Any bidder from such country must be registered with Competent Authority (DPIIT).",
            "False declaration is ground for immediate contract termination and legal action.",
            "",
            "--- Thank You ---",
        ]
    ]

    # Document 2: Indian Railways NCR Tender (Traction Motor Bearings)
    railway_pages = [
        # Page 1
        [
            "# STORES/NORTH CENTRAL RAILWAY -- TENDER DOCUMENT",
            "Tender No: 20263463 | Closing Date/Time: 05/10/2026 10:15 Hrs",
            "Principal Chief Materials Manager, acting for and on behalf of The President of India.",
            "",
            "## 1. NIT HEADER",
            "Bidding Type: Normal Tender | Contract Type: Goods (Expenditure)",
            "Tender Type: Limited - Indigenous | Bidding System: Single Packet",
            "Inspection Agency: CONSIGNEE | Approving Agency: RDSO",
            "Procure From Approved Sources: Yes (RDSO Item ID: 3100279)",
            "Tender Title: Bearing 6206RC3 for traction motor scavenger blower motor",
            "Earnest Money (INR): 0.00 | Tender Doc Cost: 0.00 | Validity: 90 Days",
            "",
            "## 2. ITEM DETAILS",
            "PL Code: 29030080 | Consignees: SMM/ELS/JHS (20 Nos), SMM/ETD/KANPUR (204 Nos)",
            "Warranty Period: 30 Months after the date of delivery.",
            "Payment Terms: 100% payment after receipt and acceptance of material.",
        ],
        # Page 2
        [
            "## 3. SPECIAL ELIGIBILITY CRITERIA",
            "Clause 1: Item is reserved to be procured from RDSO approved sources only (UVAM ID: 3100279).",
            "Clause 1(a): Purchaser reserves right to procure bulk quantity from RDSO approved vendors.",
            "Clause 1(b): Developmental Vendors on UVAM eligible for orders up to 20% Net Procurable Quantity.",
            "Clause 1(c): Where <= 3 approved Indian suppliers exist, developmental vendors considered for bulk order.",
        ],
        # Page 3
        [
            "## 4. COMPLIANCE CONDITIONS & CHECKLIST",
            "Checklist: Have you attached performance statements? Quoted in prescribed format?",
            "Submitted authenticated copy of document authorizing signatory? Income tax clearance certificate?",
        ],
        # Page 4
        [
            "## 5. LAND BORDER RESTRICTIONS & MAKE IN INDIA",
            "Clause 1: Compliance certificate under Ministry of Finance OM dated 23.07.2020 required.",
            "Clause 2: Percentage of local content entered constitutes self-certification under Make in India policy.",
            "Clause 3: Non-compliance or false declaration leads to contract termination and penal action.",
        ],
        # Page 5
        [
            "## 6. SPECIAL CONDITIONS & IRS CONTRACT",
            "Clause 5: Hard copy of Purchase Order will not be issued; only digitally signed online copies.",
            "Clause 6: Security Deposit (SD) and EMD applicable as per IRS Conditions of Contract 2025.",
            "Clause 9: Offer must strictly comply with IRS conditions of contract without deviations.",
        ],
        # Page 6
        [
            "## 7. BIDDER RESPONSIBILITY & GENUINENESS OF DOCUMENTS",
            "Clause 4: Bidders solely responsible for authenticity of certificates and test reports.",
            "Submission of forged/altered documents leads to debarment/banning for up to 2 years and criminal action.",
        ],
        # Page 7
        [
            "## 8. DOCUMENTS ATTACHED & RESPONSIVENESS",
            "Attached Docs: IRSConditionsofContractforSupplyContract_2025.pdf (5646539.pdf)",
            "               NewInstructionstoTenderersGeneralConditions_25.pdf (5851418.pdf)",
            "Validity: Minimum 90 days required.",
            "Anti-Collusion: Bidders must confirm no sister concerns or affiliates have participated.",
            "",
            "Digitally Signed By: AMM/E (ANKIT JAIN), North Central Railway",
        ]
    ]

    gem_file = os.path.join(samples_dir, "GeM_AIIMS_Raipur_Surgical_Microscope_GEM-2026-B-8008666.pdf")
    railway_file = os.path.join(samples_dir, "Indian_Railways_NCR_Traction_Motor_Bearing_20263463.pdf")

    generate_pdf(gem_file, gem_pages)
    generate_pdf(railway_file, railway_pages)

    print(f"✅ Generated exact real-world sample tender PDFs:")
    print(f"   1. {gem_file} ({len(gem_pages)} pages)")
    print(f"   2. {railway_file} ({len(railway_pages)} pages)")

if __name__ == "__main__":
    main()
