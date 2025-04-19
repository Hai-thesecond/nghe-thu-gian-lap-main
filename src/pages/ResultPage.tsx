const getStudentCategory = (student: any) => {
  // ... existing code ...
  
  // Thay đổi các điều kiện trả về 'weak' thành 'poor'
  return { label: 'Yếu', value: 'poor', color: 'bg-red-100 text-red-800' };
  // ... existing code ...
};

// Thay đổi trong các case statements
switch (category) {
  // ... existing code ...
  case 'poor':
    return 'bg-red-100 text-red-800';
  // ... existing code ...
}

// Thay đổi trong các component SelectItem
<SelectItem value="poor">Yếu</SelectItem>

// Thay đổi trong các điều kiện or checks
if (category === 'poor') {
  // ... existing code ...
}

// ... existing code ... 