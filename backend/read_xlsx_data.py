import openpyxl
import os

filepath = '../updated sheet.xlsx'
if not os.path.exists(filepath):
    filepath = 'updated sheet.xlsx'

wb = openpyxl.load_workbook(filepath)

for sheet_name in ['Supplier Stats', 'Supplier Monthly Stats', 'Delay Event Logs']:
    if sheet_name in wb.sheetnames:
        sheet = wb[sheet_name]
        print(f"\n=== {sheet_name} ===")
        rows = list(sheet.iter_rows(values_only=True))
        if rows:
            print("Headers:", rows[0])
            print("Row count:", len(rows) - 1)
            for idx, r in enumerate(rows[1:4]):
                print(f"Row {idx+1}:", r)
        else:
            print("Empty sheet")
    else:
        print(f"\nSheet {sheet_name} not found!")
