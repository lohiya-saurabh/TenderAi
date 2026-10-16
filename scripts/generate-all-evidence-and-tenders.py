#!/usr/bin/env python3
"""
Generate realistic, authentic Indian Procurement Evidence and Tender PDF files.
Generates valid standard PDF 1.4 documents without third-party dependencies.
"""

import os

def build_pdf_stream(text_lines):
    stream_content = "BT\n/F1 11 Tf\n14 TL\n45 755 Td\n"
    for line in text_lines:
        line_clean = (
            line.replace("—", "--")
            .replace("–", "-")
            .replace("₹", "Rs. ")
            .replace("“", "\"")
            .replace("”", "\"")
            .replace("’", "'")
        )
        if line_clean.startswith("# "):
            stream_content += f"/F1 15 Tf ({line_clean[2:]}) Tj T*\n/F1 11 Tf\n"
        elif line_clean.startswith("## "):
            stream_content += f"/F1 13 Tf ({line_clean[3:]}) Tj T*\n/F1 11 Tf\n"
        elif line_clean.startswith("### "):
            stream_content += f"/F1 11.5 Tf ({line_clean[4:]}) Tj T*\n/F1 11 Tf\n"
        elif line_clean == "":
            stream_content += "T*\n"
        else:
            escaped = line_clean.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            stream_content += f"({escaped}) Tj T*\n"
    stream_content += "ET\n"
    return stream_content

def generate_pdf(output_path, pages_text_list):
    """Generates a valid multi-page PDF document."""
    objects = []
    objects.append("<< /Type /Catalog /Pages 2 0 R >>")
    page_count = len(pages_text_list)
    page_refs = " ".join([f"{3 + i * 2} 0 R" for i in range(page_count)])
    objects.append(f"<< /Type /Pages /Kids [ {page_refs} ] /Count {page_count} >>")
    
    for i, page_lines in enumerate(pages_text_list):
        content_obj_id = 4 + i * 2
        page_obj = (
            f"<< /Type /Page /Parent 2 0 R /MediaBox [0 0 612 792] "
            f"/Resources << /Font << /F1 << /Type /Font /Subtype /Type1 /BaseFont /Helvetica >> >> >> "
            f"/Contents {content_obj_id} 0 R >>"
        )
        objects.append(page_obj)
        stream_data = build_pdf_stream(page_lines)
        stream_len = len(stream_data.encode("latin1"))
        content_obj = f"<< /Length {stream_len} >>\nstream\n{stream_data}endstream"
        objects.append(content_obj)
    
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
        f.writelines(f"{offset:010d} 00000 n \n".encode("latin1") for offset in offsets)
        
        trailer = (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        )
        f.write(trailer.encode("latin1"))

def main():
    root = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
    evidence_base = os.path.join(root, "data/procurement-evidence")
    tenders_base = os.path.join(evidence_base, "01_Tender_Documents")
    
    # -------------------------------------------------------------------------
    # 1. Evidence PDFs for the 5 Companies
    # -------------------------------------------------------------------------
    
    # Company 2: Ashoka Concessions Limited
    generate_pdf(
        os.path.join(evidence_base, "Ashoka_Concessions_CA_Turnover_Certificate.pdf"),
        [[
            "# S R B C & CO LLP, CHARTERED ACCOUNTANTS",
            "## STATUTORY AUDITOR ANNUAL FINANCIAL TURNOVER & NET WORTH CERTIFICATE",
            "ICAI UDIN: 24324982BBBBBB1029 | Firm Registration No: 324982E/E300003",
            "Entity: ASHOKA CONCESSIONS LIMITED (CIN: U45201MH2011PLC215760)",
            "Date of Issue: 18-June-2024 | Validity: Through FY 2026-27",
            "",
            "### 1. SUMMARY OF AUDITED ANNUAL FINANCIAL TURNOVER",
            "This is to certify that we have examined the audited financial statements of",
            "Ashoka Concessions Limited having its registered office at Nashik, Maharashtra.",
            "- FY 2021-22 Audited Annual Turnover: Rs. 1,820.00 Crores",
            "- FY 2022-23 Audited Annual Turnover: Rs. 2,030.00 Crores",
            "- FY 2023-24 Audited Annual Turnover: Rs. 2,450.00 Crores",
            "3-Year Average Annual Financial Turnover: Rs. 2,100.00 Crores.",
            "Audited Net Worth as on 31-March-2024: Rs. 1,420.00 Crores (Positive).",
            "",
            "### 2. STATUTORY ATTESTATION",
            "The figures stated above are true and correct as extracted from the audited books of accounts.",
            "Issued under practicing CA membership no: 049821, Partner, S R B C & CO LLP."
        ]]
    )

    generate_pdf(
        os.path.join(evidence_base, "Ashoka_Concessions_Crisil_Solvency_Certificate.pdf"),
        [[
            "# CRISIL RATINGS LIMITED",
            "## BANK SOLVENCY ASSESSMENT & SANCTIONED CREDIT FACILITIES RATIONALE",
            "Reference: CRISIL/RR/2024-25/ACL-450 | Date: 15-January-2025",
            "Entity: ASHOKA CONCESSIONS LIMITED (CIN: U45201MH2011PLC215760)",
            "",
            "### 1. CREDIT ASSESSMENT SUMMARY",
            "Total Sanctioned Fund-based and Non-Fund based Bank Working Capital Facilities:",
            "Rs. 450.00 Crores (Rupees Four Hundred Fifty Crores Only).",
            "- Long-Term Bank Facilities: Rs. 200.00 Crores (Rated CRISIL A+ / Stable)",
            "- Short-Term Bank Facilities (BG / LC): Rs. 250.00 Crores (Rated CRISIL A1)",
            "Solvency Ceiling Limit certified for NHAI and State Procurement: Rs. 450.00 Crores.",
            "Valid through 31-December-2026."
        ]]
    )

    generate_pdf(
        os.path.join(evidence_base, "Ashoka_Concessions_NHAI_LoA_Belgaum.pdf"),
        [[
            "# NATIONAL HIGHWAYS AUTHORITY OF INDIA (NHAI)",
            "## LETTER OF AWARD (LoA) -- HYBRID ANNUITY MODE (HAM)",
            "Ref: NHAI/HAM/NH-4A/BELGAUM-KHANAPUR/LOA/2021 | Date: 12-Nov-2021",
            "To: Ashoka Concessions Limited, Nashik",
            "",
            "Sub: Four-Laning of Belgaum-Khanapur Section of NH-4A (Km 0.000 to Km 30.800) in Karnataka.",
            "1. We are pleased to inform you that your bid for the subject project on HAM basis",
            "   has been accepted at the Bid Project Cost of Rs. 850.00 Crores.",
            "2. Total Executed Contract Value: Rs. 850.00 Crores.",
            "3. Commercial Operation Achieved on 15-October-2023."
        ]]
    )

    # Company 3: Viva Highways Limited
    generate_pdf(
        os.path.join(evidence_base, "Viva_Highways_CA_Turnover_Certificate.pdf"),
        [[
            "# K S P & ASSOCIATES, CHARTERED ACCOUNTANTS",
            "## STATUTORY AUDITOR FINANCIAL TURNOVER & NET WORTH CERTIFICATE",
            "ICAI UDIN: 24324982CCCCCC3847 | Firm Registration No: 124859W",
            "Entity: VIVA HIGHWAYS LIMITED (CIN: U45200MH1996PLC098254)",
            "Date of Issue: 22-July-2024 | Validity: Through FY 2026-27",
            "",
            "### 1. SUMMARY OF AUDITED ANNUAL FINANCIAL TURNOVER",
            "- FY 2021-22 Audited Annual Turnover: Rs. 360.00 Crores",
            "- FY 2022-23 Audited Annual Turnover: Rs. 420.00 Crores",
            "- FY 2023-24 Audited Annual Turnover: Rs. 480.00 Crores",
            "3-Year Average Annual Financial Turnover: Rs. 420.00 Crores.",
            "Audited Net Worth as on 31-March-2024: Rs. 185.00 Crores.",
            "Specialization: Toll Plaza Operations, Smart Highway Maintenance, Pavement Overlays."
        ]]
    )

    generate_pdf(
        os.path.join(evidence_base, "Viva_Highways_SBI_Solvency_Certificate.pdf"),
        [[
            "# STATE BANK OF INDIA -- COMMERCIAL BRANCH NASHIK",
            "## BANK SOLVENCY CERTIFICATE FOR PUBLIC TENDERS",
            "Ref: SBI/CB/NAS/SOLV/2025/120 | Date: 05-February-2025",
            "This is to certify that M/s VIVA HIGHWAYS LIMITED (CIN: U45200MH1996PLC098254),",
            "is solvent to the extent of Rs. 120.00 Crores (Rupees One Hundred Twenty Crores Only).",
            "The company maintains satisfactory credit relations and sanctioned facilities of Rs. 120.00 Cr.",
            "Valid through 31-December-2026."
        ]]
    )

    generate_pdf(
        os.path.join(evidence_base, "Viva_Highways_Toll_OM_Completion_Certificate.pdf"),
        [[
            "# MAHARASHTRA STATE ROAD DEVELOPMENT CORPORATION (MSRDC)",
            "## TOLL OPERATIONS & PAVEMENT MAINTENANCE COMPLETION CERTIFICATE",
            "Ref: MSRDC/OM/TOLL-REV/PKG-9/2023 | Date: 10-August-2023",
            "Entity: Viva Highways Limited",
            "Project: Nashik-Pune Highway Toll Operations, Smart RFID Tolling & Pavement Overlay",
            "Executed Contract Value: Rs. 180.00 Crores. Completed successfully within scheduled timeline."
        ]]
    )

    # Company 4: Larsen & Toubro Limited - Heavy Civil IC
    generate_pdf(
        os.path.join(evidence_base, "LNT_Heavy_Civil_CA_Turnover_Certificate.pdf"),
        [[
            "# DELOITTE HASKINS & SELLS LLP, CHARTERED ACCOUNTANTS",
            "## STATUTORY AUDITOR ANNUAL FINANCIAL TURNOVER & NET WORTH CERTIFICATE",
            "ICAI UDIN: 24083742DDDDDD5921 | Firm Registration No: 117366W/W-100018",
            "Entity: LARSEN & TOUBRO LIMITED (CIN: L99999MH1946PLC004768)",
            "Operating IC: Heavy Civil Infrastructure IC, L&T House, Ballard Estate, Mumbai",
            "Date of Issue: 25-May-2024 | Validity: Through FY 2026-27",
            "",
            "### 1. SUMMARY OF AUDITED CONSOLIDATED FINANCIAL TURNOVER",
            "- FY 2021-22 Audited Annual Turnover: Rs. 1,56,521.00 Crores",
            "- FY 2022-23 Audited Annual Turnover: Rs. 1,83,341.00 Crores",
            "- FY 2023-24 Audited Annual Turnover: Rs. 2,21,113.00 Crores",
            "3-Year Average Annual Financial Turnover: Rs. 1,86,991.67 Crores (Baseline: Rs. 1,83,000 Cr+).",
            "Consolidated Net Worth as on 31-March-2024: Rs. 89,450.00 Crores.",
            "Heavy Civil IC Division Track Record: Bridges, Metro Viaducts, Tunnels, Nuclear & River Bridges."
        ]]
    )

    generate_pdf(
        os.path.join(evidence_base, "LNT_Heavy_Civil_Bank_Solvency_Certificate.pdf"),
        [[
            "# STATE BANK OF INDIA & CONSORTIUM OF SCHEDULED BANKS",
            "## MEGA INFRASTRUCTURE BANK SOLVENCY CERTIFICATE",
            "Ref: SBI/CAG/MUM/LNT-HC/2025/15000 | Date: 02-January-2025",
            "Entity: LARSEN & TOUBRO LIMITED - HEAVY CIVIL IC",
            "CIN: L99999MH1946PLC004768",
            "",
            "This is to certify that Larsen & Toubro Limited is solvent and enjoys aggregate sanctioned",
            "working capital and bank guarantee facilities exceeding Rs. 15,000.00 Crores",
            "(Rupees Fifteen Thousand Crores Only) with AAA Credit Rating across consortium banks.",
            "Certified for Major Infrastructure Tenders (Bridges, High-Speed Rail, Metros)."
        ]]
    )

    generate_pdf(
        os.path.join(evidence_base, "LNT_MTHL_Cable_Stayed_Bridge_LoA.pdf"),
        [[
            "# MUMBAI METROPOLITAN REGION DEVELOPMENT AUTHORITY (MMRDA)",
            "## COMPLETION CERTIFICATE -- MUMBAI TRANS HARBOUR LINK (MTHL PKG-1)",
            "Ref: MMRDA/ENG/MTHL/PKG-1/2024/7637 | Date: 12-January-2024",
            "Contractor: Larsen & Toubro Limited - Heavy Civil Infrastructure IC",
            "",
            "Project: Construction of 10.380 Km Long Sea Bridge Section including 180m Orthotropic Steel Deck (OSD)",
            "and Cable-Stayed Navigation Span across Thane Creek.",
            "Final Completed Contract Value: Rs. 7,637.00 Crores.",
            "Status: Successfully commissioned and dedicated to the nation by the Hon'ble Prime Minister."
        ]]
    )

    generate_pdf(
        os.path.join(evidence_base, "LNT_NCRTC_Metro_Viaduct_Completion_Certificate.pdf"),
        [[
            "# NATIONAL CAPITAL REGION TRANSPORT CORPORATION (NCRTC)",
            "## COMPLETION CERTIFICATE -- DELHI-MEERUT RRTS CORRIDOR PKG-3",
            "Ref: NCRTC/RRTS/PKG-3/COMP/2023 | Date: 20-October-2023",
            "Contractor: Larsen & Toubro Limited - Heavy Civil IC",
            "Project: Construction of Elevated Viaduct from Duhai to Meerut South with 7 Elevated Stations.",
            "Executed Contract Value: Rs. 2,420.00 Crores.",
            "Status: Commissioned and operational."
        ]]
    )

    # Company 5: L&T Transportation Infrastructure Limited
    generate_pdf(
        os.path.join(evidence_base, "LNT_Transportation_CA_Turnover_Certificate.pdf"),
        [[
            "# SHARP & TANNAN, CHARTERED ACCOUNTANTS",
            "## STATUTORY AUDITOR ANNUAL FINANCIAL TURNOVER & NET WORTH CERTIFICATE",
            "ICAI UDIN: 24083742EEEEEE8473 | Firm Registration No: 109982W",
            "Entity: L&T TRANSPORTATION INFRASTRUCTURE LIMITED (CIN: U45203TN1997PLC038596)",
            "Date of Issue: 10-June-2024 | Validity: Through FY 2026-27",
            "",
            "### 1. SUMMARY OF AUDITED ANNUAL FINANCIAL TURNOVER",
            "- FY 2021-22 Audited Annual Turnover: Rs. 4,800.00 Crores",
            "- FY 2022-23 Audited Annual Turnover: Rs. 5,400.00 Crores",
            "- FY 2023-24 Audited Annual Turnover: Rs. 6,600.00 Crores",
            "3-Year Average Annual Financial Turnover: Rs. 5,600.00 Crores.",
            "Audited Net Worth as on 31-March-2024: Rs. 2,850.00 Crores.",
            "Specialization: Expressways, Access-Controlled Corridors, Highway EPC."
        ]]
    )

    generate_pdf(
        os.path.join(evidence_base, "LNT_Transportation_Solvency_Certificate.pdf"),
        [[
            "# ICICI BANK LIMITED -- CORPORATE BANKING GROUP",
            "## BANK SOLVENCY ASSESSMENT & SANCTIONED CREDIT FACILITIES",
            "Ref: ICICI/CBG/CHE/LNT-TI/2025/900 | Date: 08-January-2025",
            "Entity: L&T TRANSPORTATION INFRASTRUCTURE LIMITED (CIN: U45203TN1997PLC038596)",
            "This is to certify that L&T Transportation Infrastructure Limited is solvent to the extent of",
            "Rs. 900.00 Crores (Rupees Nine Hundred Crores Only).",
            "The company holds sanctioned non-fund and fund-based credit lines of Rs. 900.00 Cr.",
            "Valid through 31-December-2026."
        ]]
    )

    generate_pdf(
        os.path.join(evidence_base, "LNT_Expressway_EPC_Completion_Certificate.pdf"),
        [[
            "# NATIONAL HIGHWAYS AUTHORITY OF INDIA (NHAI)",
            "## COMPLETION CERTIFICATE -- VADODARA-MUMBAI EXPRESSWAY (PKG-1)",
            "Ref: NHAI/EPC/VME/PKG-1/2023 | Date: 14-November-2023",
            "Contractor: L&T Transportation Infrastructure Limited",
            "Project: 8-Lane Access Controlled Expressway Section from Km 355 to Km 390 (Vadodara-Mumbai)",
            "Executed Contract Value: Rs. 1,560.00 Crores.",
            "Status: Provisional Completion achieved and open for public traffic."
        ]]
    )

    # Common ISO and Statutory Identity for L&T Entities
    generate_pdf(
        os.path.join(evidence_base, "LNT_ISO_Integrated_Management_System_Certificate.pdf"),
        [[
            "# BUREAU VERITAS CERTIFICATION -- GLOBAL ACCREDITATION",
            "## INTEGRATED MANAGEMENT SYSTEM (IMS) CERTIFICATE",
            "Certificate No: IND.23.8471/U | Valid Until: 15-November-2026",
            "Certified Entity: LARSEN & TOUBRO LIMITED (All Infrastructure ICs)",
            "",
            "Scope of Certification:",
            "- ISO 9001:2015: Quality Management System for Mega Civil, Bridges, Metro, and Highway Works.",
            "- ISO 14001:2015: Environmental Management System for Infrastructure Execution.",
            "- ISO 45001:2018: Occupational Health and Safety Management System."
        ]]
    )

    # -------------------------------------------------------------------------
    # 2. Ingest 10 Diverse Procurement Tenders (PDFs)
    # -------------------------------------------------------------------------
    tenders = [
        ("01_NHAI_HAM_850Cr_NIT.pdf", "NATIONAL HIGHWAYS AUTHORITY OF INDIA", "NIT-NHAI-HAM-2026-PKG850", "Four-Laning of NHAI Highway Section under HAM", "Rs. 850.00 Crores", "Rs. 340.00 Crores", "Rs. 297.50 Crores"),
        ("02_NHAI_Greenfield_Exp_1450Cr_NIT.pdf", "NATIONAL HIGHWAYS AUTHORITY OF INDIA", "NIT-NHAI-EXP-2026-PKG1450", "Access-Controlled Greenfield Expressway EPC Package", "Rs. 1,450.00 Crores", "Rs. 580.00 Crores", "Rs. 507.50 Crores"),
        ("03_NCRTC_Metro_Viaduct_1120Cr_NIT.pdf", "NATIONAL CAPITAL REGION TRANSPORT CORP", "NIT-NCRTC-RRTS-2026-VIAD1120", "Elevated Metro Viaduct and 6 Station Buildings", "Rs. 1,120.00 Crores", "Rs. 448.00 Crores", "Rs. 392.00 Crores"),
        ("04_RVNL_Rail_Bridge_620Cr_NIT.pdf", "RAIL VIKAS NIGAM LIMITED", "NIT-RVNL-BRIDGE-2026-RB620", "Railway Doubling and Major River Bridge Superstructure", "Rs. 620.00 Crores", "Rs. 248.00 Crores", "Rs. 217.00 Crores"),
        ("05_MSRDC_Cable_Stayed_Bridge_2100Cr_NIT.pdf", "MAHARASHTRA STATE ROAD DEV CORP", "NIT-MSRDC-CSB-2026-BR2100", "Coastal Highway Cable-Stayed Sea Bridge Package", "Rs. 2,100.00 Crores", "Rs. 840.00 Crores", "Rs. 735.00 Crores"),
        ("06_MoRTH_Mountain_Highway_480Cr_NIT.pdf", "MINISTRY OF ROAD TRANSPORT & HIGHWAYS", "NIT-MORTH-NE-2026-HWY480", "Strategic Mountain Highway 2-Laning with Paved Shoulders", "Rs. 480.00 Crores", "Rs. 192.00 Crores", "Rs. 168.00 Crores"),
        ("07_CPWD_MultiModal_Hub_320Cr_NIT.pdf", "CENTRAL PUBLIC WORKS DEPARTMENT", "NIT-CPWD-MMH-2026-HUB320", "Multi-Modal Logistics and Modern Warehousing Hub", "Rs. 320.00 Crores", "Rs. 128.00 Crores", "Rs. 112.00 Crores"),
        ("08_NHAI_ATMS_Tolling_180Cr_NIT.pdf", "NATIONAL HIGHWAYS AUTHORITY OF INDIA", "NIT-IHMCL-ATMS-2026-TOLL180", "Advanced Traffic Management & Multi-Lane Free Flow Tolling", "Rs. 180.00 Crores", "Rs. 72.00 Crores", "Rs. 63.00 Crores"),
        ("09_State_Highway_Pavement_240Cr_NIT.pdf", "STATE HIGHWAYS PUBLIC WORKS DEPARTMENT", "NIT-SHPWD-REHAB-2026-PAV240", "State Highway Pavement Rehabilitation & Resurfacing Overlay", "Rs. 240.00 Crores", "Rs. 96.00 Crores", "Rs. 84.00 Crores"),
        ("10_NHAI_Outer_Ring_Exp_1850Cr_NIT.pdf", "NATIONAL HIGHWAYS AUTHORITY OF INDIA", "NIT-NHAI-ORR-2026-PKG1850", "Outer Ring Access-Controlled Expressway Phase-II EPC", "Rs. 1,850.00 Crores", "Rs. 740.00 Crores", "Rs. 647.50 Crores"),
    ]

    for fname, auth, tnum, desc, val, to_req, exp_req in tenders:
        pdf_path = os.path.join(tenders_base, fname)
        pages = [
            [
                f"# {auth}",
                "## NOTICE INVITING TENDER (NIT) -- INVITATION FOR BIDS",
                f"Tender Reference: {tnum}",
                f"Project Description: {desc}",
                f"Estimated Project Value: {val}",
                "Contract Mode: Engineering, Procurement and Construction (EPC) / HAM",
                "Submission Deadline: 30-November-2026 at 15:00 Hrs IST",
                "",
                "### 1. FINANCIAL CAPACITY CRITERIA (CLAUSE 2.2.2.1)",
                f"- Minimum 3-Year Average Financial Turnover Requirement: {to_req}",
                "- Practicing Chartered Accountant Certificate with genuine ICAI UDIN is mandatory.",
                "- Solvency Certificate from Scheduled Commercial Bank: Minimum 20% of project cost.",
                "",
                "### 2. TECHNICAL QUALIFICATION CRITERIA (CLAUSE 2.2.2.2)",
                f"- Single Largest Completed Project Experience Requirement: {exp_req}",
                "- Must be substantiated with Client Completion Certificate / Commercial Operation (COD).",
                "",
                "### 3. STATUTORY & ACCREDITATION REQUIREMENTS (CLAUSE 3.1)",
                "- Valid GSTIN Registration, Corporate PAN Card, and MCA Certificate of Incorporation.",
                "- Valid ISO 9001:2015 Quality and ISO 14001:2015 Environmental accreditations.",
                "- Liquidated Damages: 0.5% per week of delay up to a ceiling of 10% contract value."
            ]
        ]
        generate_pdf(pdf_path, pages)
        print(f"✅ Generated tender PDF: {fname}")

    print("\n✨ All procurement evidence and 10 tender documents successfully generated!")

if __name__ == "__main__":
    main()
