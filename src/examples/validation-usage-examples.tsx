/**
 * Validation Schema Usage Examples
 * 
 * This file demonstrates how to use the comprehensive validation schemas
 * in React forms, API routes, and other parts of the application.
 */

import { 
  CheckSchema,
  VendorSchema,
  BankSchema,
  UserSchema,
  LoginSchema,
  ReAuthSchema,
  ReportFilterSchema,
  validateAndSanitize,
  getFormattedErrors,
  type CheckFormData,
  type VendorFormData,
  type BankFormData,
  type UserFormData,
  type LoginData,
  type ReAuthData,
  type ReportFilterData,
} from '@/lib/validations';

// =============================================================================
// REACT FORM USAGE EXAMPLES
// =============================================================================

/**
 * Example: Check Form Component
 */
export function CheckFormExample() {
  const handleSubmit = async (formData: FormData) => {
    // Convert FormData to object
    const data = {
      checkNumber: formData.get('checkNumber') as string,
      amount: parseFloat(formData.get('amount') as string),
      payeeName: formData.get('payeeName') as string,
      memo: formData.get('memo') as string,
      bankId: formData.get('bankId') as string,
      vendorId: formData.get('vendorId') as string,
      paymentMethod: formData.get('paymentMethod') as string,
    };

    // Validate the data
    const validation = validateAndSanitize(CheckSchema, data);

    if (!validation.success) {
      // Handle validation errors
      const errors = getFormattedErrors(validation.errors!);
      console.error('Validation errors:', errors);
      
      // Display errors to user
      Object.entries(errors).forEach(([field, message]) => {
        console.error(`${field}: ${message}`);
      });
      
      return;
    }

    // Data is valid, proceed with API call
    try {
      const response = await fetch('/api/checks', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      });

      if (response.ok) {
        console.log('Check created successfully');
      } else {
        console.error('Failed to create check');
      }
    } catch (error) {
      console.error('Error creating check:', error);
    }
  };

  return (
    <form action={handleSubmit}>
      {/* Form fields would go here */}
    </form>
  );
}

/**
 * Example: Vendor Form with React Hook Form
 */
export function VendorFormWithReactHookForm() {
  const { register, handleSubmit, formState: { errors }, setError } = useForm<VendorFormData>();

  const onSubmit = async (data: VendorFormData) => {
    // Validate with Zod
    const validation = validateAndSanitize(VendorSchema, data);

    if (!validation.success) {
      // Set React Hook Form errors
      const zodErrors = getFormattedErrors(validation.errors!);
      Object.entries(zodErrors).forEach(([field, message]) => {
        setError(field as keyof VendorFormData, { message });
      });
      return;
    }

    // Submit validated data
    try {
      const response = await fetch('/api/vendors', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validation.data),
      });

      if (response.ok) {
        console.log('Vendor created successfully');
      }
    } catch (error) {
      console.error('Error creating vendor:', error);
    }
  };

  return (
    <form onSubmit={handleSubmit(onSubmit)}>
      <input
        {...register('vendorName')}
        placeholder="Vendor Name"
      />
      {errors.vendorName && <span>{errors.vendorName.message}</span>}

      <select {...register('vendorType')}>
        <option value="">Select Type</option>
        <option value="Merchandise">Merchandise</option>
        <option value="Expense">Expense</option>
        <option value="Employee">Employee</option>
      </select>
      {errors.vendorType && <span>{errors.vendorType.message}</span>}

      <input
        {...register('contact.email')}
        placeholder="Email (optional)"
      />
      {errors.contact?.email && <span>{errors.contact.email.message}</span>}

      <input
        {...register('contact.phone')}
        placeholder="Phone (optional)"
      />
      {errors.contact?.phone && <span>{errors.contact.phone.message}</span>}

      <button type="submit">Create Vendor</button>
    </form>
  );
}

// =============================================================================
// API ROUTE USAGE EXAMPLES
// =============================================================================

/**
 * Example: Check API Route
 */
export async function POST_CheckAPI(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request body
    const validation = validateAndSanitize(CheckSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: getFormattedErrors(validation.errors!),
        },
        { status: 400 }
      );
    }

    const checkData = validation.data;

    // Proceed with business logic
    const newCheck = await prisma.check.create({
      data: checkData,
    });

    return NextResponse.json(newCheck, { status: 201 });

  } catch (error) {
    console.error('Error creating check:', error);
    return NextResponse.json(
      { error: 'Failed to create check' },
      { status: 500 }
    );
  }
}

/**
 * Example: Bank API Route
 */
export async function POST_BankAPI(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request body
    const validation = validateAndSanitize(BankSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: getFormattedErrors(validation.errors!),
        },
        { status: 400 }
      );
    }

    const bankData = validation.data;

    // Check if routing number is valid (basic check)
    const routingNumber = bankData.routingNumber;
    if (!isValidRoutingNumber(routingNumber)) {
      return NextResponse.json(
        { error: 'Invalid routing number' },
        { status: 400 }
      );
    }

    // Proceed with business logic
    const newBank = await prisma.bank.create({
      data: bankData,
    });

    return NextResponse.json(newBank, { status: 201 });

  } catch (error) {
    console.error('Error creating bank:', error);
    return NextResponse.json(
      { error: 'Failed to create bank' },
      { status: 500 }
    );
  }
}

/**
 * Example: User API Route
 */
export async function POST_UserAPI(req: NextRequest) {
  try {
    const body = await req.json();
    
    // Validate request body
    const validation = validateAndSanitize(UserSchema, body);

    if (!validation.success) {
      return NextResponse.json(
        {
          error: 'Validation failed',
          details: getFormattedErrors(validation.errors!),
        },
        { status: 400 }
      );
    }

    const userData = validation.data;

    // Check if username already exists
    const existingUser = await prisma.user.findUnique({
      where: { username: userData.username },
    });

    if (existingUser) {
      return NextResponse.json(
        { error: 'Username already exists' },
        { status: 400 }
      );
    }

    // Hash password
    const hashedPassword = await hash(userData.password, 12);

    // Proceed with business logic
    const newUser = await prisma.user.create({
      data: {
        ...userData,
        password: hashedPassword,
      },
    });

    return NextResponse.json(newUser, { status: 201 });

  } catch (error) {
    console.error('Error creating user:', error);
    return NextResponse.json(
      { error: 'Failed to create user' },
      { status: 500 }
    );
  }
}

// =============================================================================
// MIDDLEWARE USAGE EXAMPLES
// =============================================================================

/**
 * Example: Validation Middleware
 */
export function createValidationMiddleware<T>(schema: z.ZodSchema<T>) {
  return async (req: NextRequest, next: () => Promise<NextResponse>) => {
    try {
      const body = await req.json();
      
      // Validate request body
      const validation = validateAndSanitize(schema, body);

      if (!validation.success) {
        return NextResponse.json(
          {
            error: 'Validation failed',
            details: getFormattedErrors(validation.errors!),
          },
          { status: 400 }
        );
      }

      // Add validated data to request
      (req as any).validatedData = validation.data;

      return next();

    } catch (error) {
      return NextResponse.json(
        { error: 'Invalid request body' },
        { status: 400 }
      );
    }
  };
}

/**
 * Example: Using validation middleware
 */
export async function POST_WithValidation(req: NextRequest) {
  // Validation middleware would have already validated the data
  const validatedData = (req as any).validatedData as CheckFormData;

  // Proceed with business logic
  const newCheck = await prisma.check.create({
    data: validatedData,
  });

  return NextResponse.json(newCheck, { status: 201 });
}

// =============================================================================
// CLIENT-SIDE VALIDATION EXAMPLES
// =============================================================================

/**
 * Example: Real-time validation in React
 */
export function useRealTimeValidation<T>(schema: z.ZodSchema<T>) {
  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateField = useCallback((field: string, value: any) => {
    try {
      // Create a partial schema for the specific field
      const fieldSchema = schema.pick({ [field]: true } as any);
      fieldSchema.parse({ [field]: value });
      
      // Clear error if validation passes
      setErrors(prev => {
        const newErrors = { ...prev };
        delete newErrors[field];
        return newErrors;
      });
    } catch (error) {
      if (error instanceof z.ZodError) {
        const fieldError = error.issues.find(issue => issue.path[0] === field);
        if (fieldError) {
          setErrors(prev => ({
            ...prev,
            [field]: fieldError.message,
          }));
        }
      }
    }
  }, [schema]);

  const validateForm = useCallback((data: any) => {
    const validation = validateAndSanitize(schema, data);
    
    if (!validation.success) {
      const errors = getFormattedErrors(validation.errors!);
      setErrors(errors);
      return { success: false, errors };
    }

    setErrors({});
    return { success: true, data: validation.data };
  }, [schema]);

  return { errors, validateField, validateForm };
}

/**
 * Example: Using real-time validation
 */
export function CheckFormWithRealTimeValidation() {
  const { errors, validateField, validateForm } = useRealTimeValidation(CheckSchema);
  const [formData, setFormData] = useState<Partial<CheckFormData>>({});

  const handleFieldChange = (field: keyof CheckFormData, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    validateField(field, value);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    const validation = validateForm(formData);
    
    if (validation.success) {
      // Submit form
      console.log('Submitting:', validation.data);
    }
  };

  return (
    <form onSubmit={handleSubmit}>
      <input
        value={formData.checkNumber || ''}
        onChange={(e) => handleFieldChange('checkNumber', e.target.value)}
        placeholder="Check Number"
      />
      {errors.checkNumber && <span className="error">{errors.checkNumber}</span>}

      <input
        type="number"
        step="0.01"
        value={formData.amount || ''}
        onChange={(e) => handleFieldChange('amount', parseFloat(e.target.value))}
        placeholder="Amount"
      />
      {errors.amount && <span className="error">{errors.amount}</span>}

      <button type="submit">Create Check</button>
    </form>
  );
}

// =============================================================================
// UTILITY FUNCTIONS
// =============================================================================

/**
 * Check if routing number is valid (basic validation)
 */
function isValidRoutingNumber(routingNumber: string): boolean {
  // Basic checksum validation for US routing numbers
  if (routingNumber.length !== 9) return false;
  
  const digits = routingNumber.split('').map(Number);
  const checksum = (
    3 * (digits[0] + digits[3] + digits[6]) +
    7 * (digits[1] + digits[4] + digits[7]) +
    1 * (digits[2] + digits[5] + digits[8])
  ) % 10;
  
  return checksum === 0;
}

/**
 * Format currency for display
 */
export function formatCurrency(amount: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
  }).format(amount);
}

/**
 * Format phone number for display
 */
export function formatPhoneNumber(phone: string): string {
  const cleaned = phone.replace(/\D/g, '');
  const match = cleaned.match(/^(\d{3})(\d{3})(\d{4})$/);
  
  if (match) {
    return `(${match[1]}) ${match[2]}-${match[3]}`;
  }
  
  return phone;
}

/**
 * Sanitize HTML input
 */
export function sanitizeHtml(input: string): string {
  return input
    .replace(/[<>]/g, '') // Remove < and >
    .replace(/javascript:/gi, '') // Remove javascript: protocol
    .replace(/on\w+=/gi, ''); // Remove event handlers
}





