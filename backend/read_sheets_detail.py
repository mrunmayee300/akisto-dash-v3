import openpyxl
import os

filepath = '../dummy data.xlsx'
if not os.path.exists(filepath):
    filepath = 'dummy data.xlsx'

wb = openpyxl.load_workbook(filepath, data_only=True)
print("Workbook sheets:", wb.sheetnames)

for sheet_name in ['Supplier Stats', 'Supplier Monthly Stats', 'Delay Event Logs']:
    if sheet_name in wb.sheetnames:
        sheet = wb[sheet_name]
        print(f"\n=== {sheet_name} (first 10 rows) ===")
        rows = list(sheet.iter_rows(values_only=True))
        if rows:
            print("Headers:", rows[0])
            for i, r in enumerate(rows[1:11]):
                print(f"Row {i+1}:", r)
        else:
            print("Empty sheet")
    else:
        print(f"{sheet_name} not found")
