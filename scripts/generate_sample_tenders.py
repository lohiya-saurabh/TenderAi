#!/usr/bin/env python3
"""
Generate realistic Indian Procurement Tender PDF documents for local testing.
Generates valid standard PDF 1.4 files without requiring third-party libraries.
"""

import os


def build_pdf_stream(text_lines):
    stream_content = "BT\n/F1 12 Tf\n14.4 TL\n50 750 Td\n"
    for line in text_lines:
        # Normalize non-latin1 characters
        line_clean = line.replace("—", "--").replace("–", "-").replace("₹", "Rs. ").replace("“", "\"").replace("”", "\"").replace("’", "'")
        if line_clean.startswith("# "):
            # Large header
            stream_content += f"/F1 16 Tf ({line_clean[2:]}) Tj T*\n/F1 12 Tf\n"
        elif line_clean.startswith("## "):
            # Medium subheader
            stream_content += f"/F1 14 Tf ({line_clean[3:]}) Tj T*\n/F1 12 Tf\n"
        elif line_clean == "":
            stream_content += "T*\n"
        else:
            # Escape parentheses and backslashes in PDF text strings
            escaped = line_clean.replace("\\", "\\\\").replace("(", "\\(").replace(")", "\\)")
            stream_content += f"({escaped}) Tj T*\n"
    stream_content += "ET\n"
    return stream_content

def generate_pdf(output_path, title, pages_text_list):
    """Generates a valid multi-page PDF document."""
    objects = []
    
    # 1. Catalog
    objects.append("<< /Type /Catalog /Pages 2 0 R >>")
    
    # 2. Pages object (placeholder, will be updated)
    page_count = len(pages_text_list)
    page_refs = " ".join([f"{3 + i * 2} 0 R" for i in range(page_count)])
    objects.append(f"<< /Type /Pages /Kids [ {page_refs} ] /Count {page_count} >>")
    
    for i, page_lines in enumerate(pages_text_list):
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
        f.writelines(f"{offset:010d} 00000 n \n".encode("latin1") for offset in offsets)
        
        trailer = (
            f"trailer\n<< /Size {len(objects) + 1} /Root 1 0 R >>\n"
            f"startxref\n{xref_offset}\n%%EOF\n"
        )
        f.write(trailer.encode("latin1"))

def main():
    samples_dir = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "samples"))
    
    # Document 1: CPWD Civil Works Tender
    cpwd_pages = [
        [
            "# CENTRAL PUBLIC WORKS DEPARTMENT (CPWD)",
            "## NOTICE INVITING TENDER (NIT) — VOL I",
            "Tender No: CPWD/DELHI/2026/CIVIL-0491",
            "Name of Work: Construction of Sustainable Central Government Administrative Complex (Phase 2)",
            "Estimated Cost: Rs. 185,00,00,000/- (One Hundred Eighty-Five Crores)",
            "Earnest Money Deposit (EMD): Rs. 3,70,00,000/- via Bank Guarantee / FDR",
            "Time of Completion: 24 Calendar Months",
            "",
            "## 1. ELIGIBILITY AND STATUTORY CRITERIA",
            "Clause 1.1: The bidder must be an Indian entity registered under Companies Act 2013.",
            "Clause 1.2: Average Annual Financial Turnover during the last 3 financial years",
            "            must be not less than Rs. 92.50 Crores, duly certified by a Chartered",
            "            Accountant with valid Unique Document Identification Number (UDIN).",
            "Clause 1.3: Bidder must have a Positive Net Worth of minimum Rs. 40 Crores as on 31st March 2025.",
            "",
            "## 2. EXECUTION AND NOTARIAL REQUIREMENTS",
            "Clause 2.1: The Bid Submission Undertaking shall be executed on Non-Judicial",
            "            Stamp Paper of minimum Rs. 100/- denomination, duly notarized by a Public Notary.",
            "Clause 2.2: Power of Attorney (PoA) in favor of the authorized signatory must be",
            "            executed on Non-Judicial Stamp Paper of value not less than Rs. 500/-",
            "            accompanied by a certified Board of Directors resolution.",
        ],
        [
            "## 3. PUBLIC PROCUREMENT (PREFERENCE TO MAKE IN INDIA)",
            "Clause 3.1: In accordance with DPIIT Order No. P-45021/2/2017-PP (BE-II), only Class-I",
            "            Local Suppliers (minimum 50% local value addition) are eligible to participate.",
            "Clause 3.2: Bidder shall submit a Make in India Declaration on Rs. 100/- Stamp Paper",
            "            accompanied by a Statutory Auditor certificate verifying local content percentage.",
            "",
            "## 4. PERFORMANCE SECURITY & BANK GUARANTEE",
            "Clause 4.1: The successful contractor shall submit a Performance Bank Guarantee (PBG)",
            "            equal to 5% of the accepted contract value within 15 days of issuance of Letter of Award (LoA).",
            "Clause 4.2: The PBG must remain valid for a period of 60 days beyond the Defect Liability Period (DLP).",
            "",
            "## 5. SUBMISSION AND DISQUALIFICATION RULES",
            "Clause 5.1: Submissions without valid UDIN on CA certificates will be summarily rejected.",
            "Clause 5.2: Joint Ventures (JV) are permitted up to a maximum of two partners with Lead Member",
            "            holding minimum 51% equity share.",
            "Clause 5.3: Last Date and Time of Bid Submission: 01-Dec-2026 at 17:00 Hrs IST.",
        ]
    ]

    # Document 2: NHAI Highway Tender
    nhai_pages = [
        [
            "# NATIONAL HIGHWAYS AUTHORITY OF INDIA (NHAI)",
            "## NOTICE INVITING TENDER — EPC CONTRACT",
            "Tender No: NHAI/HQ/2026/EPC-4482",
            "Name of Work: Four-laning of NH-44 Bypass Section (Km 120.000 to Km 154.200)",
            "Estimated Project Cost: Rs. 245,00,00,000/- (Two Hundred Forty-Five Crores)",
            "Mode of Execution: Engineering, Procurement and Construction (EPC)",
            "",
            "## 1. TECHNICAL EXPERIENCE CRITERIA",
            "Clause 1.1: Bidder must have completed at least one 4-lane Highway EPC project of minimum",
            "            value Rs. 120 Crores in the preceding 5 financial years.",
            "Clause 1.2: Technical Key Personnel must include a Project Director with 15+ years experience.",
            "",
            "## 2. STATUTORY INTEGRITY & ANTI-BRIBERY PACT",
            "Clause 2.1: Integrity Pact must be executed on Rs. 500/- Non-Judicial Stamp Paper,",
            "            duly signed by an Authorized Director and witnessed by two independent signatories.",
        ]
    ]

    cpwd_file = os.path.join(samples_dir, "CPWD_Civil_Works_NIT_Notice_Inviting_Tender.pdf")
    nhai_file = os.path.join(samples_dir, "NHAI_EPC_Highway_Expansion_Package_44.pdf")

    generate_pdf(cpwd_file, "CPWD Administrative Complex NIT", cpwd_pages)
    generate_pdf(nhai_file, "NHAI Highway Expansion EPC", nhai_pages)

    print(f"✅ Generated sample tenders in: {samples_dir}")
    print(f"   1. {cpwd_file}")
    print(f"   2. {nhai_file}")

if __name__ == "__main__":
    main()
