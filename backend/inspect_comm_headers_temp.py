import shutil
import openpyxl
import os

src = '../dummy data.xlsx'
if not os.path.exists(src):
    src = 'dummy data.xlsx'

dst = 'temp_dummy_data.xlsx'
try:
    shutil.copy(src, dst)
    print("Copy successful!")
    wb = openpyxl.load_workbook(dst, read_only=True)
    sheet = wb['Communication Logs']

    for row in sheet.iter_rows(max_row=1, values_only=True):
        headers = row
        break

    print("Total columns:", len(headers))
    for idx in range(min(208, len(headers)), min(220, len(headers))):
        print(f"Col {idx+1} ({openpyxl.utils.get_column_letter(idx+1)}): {headers[idx]}")
except Exception as e:
    print("Failed with error:", e)
finally:
    if os.path.exists(dst):
        try:
            os.remove(dst)
        except:
            pass
