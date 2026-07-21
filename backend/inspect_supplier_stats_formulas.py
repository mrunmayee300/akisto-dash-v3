import openpyxl
import os

filepath = 'dummy data.xlsx'
if not os.path.exists(filepath):
    filepath = '../dummy data.xlsx'

wb = openpyxl.load_workbook(filepath, data_only=False)
sheet = wb['Supplier Stats']
print("=== Supplier Stats Sheet (Formulas) ===")
headers = [sheet.cell(1, col_idx).value for col_idx in range(1, sheet.max_column + 1)]

# print the second row (the first supplier data row) formulas
row2 = [sheet.cell(2, col_idx).value for col_idx in range(1, sheet.max_column + 1)]
for h, v in zip(headers, row2):
    if v is not None and not isinstance(v, (str, int, float, bool)):
        print(f"{h} (type {type(v)}):")
        for attr in dir(v):
            if not attr.startswith('__'):
                try:
                    val = getattr(v, attr)
                    print(f"  .{attr}: {val}")
                except Exception as e:
                    pass
    else:
        print(f"{h}: {v}")
