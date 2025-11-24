# Data Handling with NestJS and Angular Decorators
## Complete Technical Guide - Subjects App

---

## Table of Contents

1. [NestJS Decorators - Data Handling Pipeline](#nestjs-decorators)
2. [Angular Decorators - Frontend Data Handling](#angular-decorators)
3. [Complete Data Flow - End to End](#complete-data-flow)
4. [Advanced Data Handling Patterns](#advanced-patterns)
5. [Key Decorator Patterns Summary](#decorator-summary)

---

<a name="nestjs-decorators"></a>
## Section 1: NestJS Decorators - Data Handling Pipeline

### 1.1 Controller Layer - Request Data Extraction

**File:** `backend/src/subjects/subjects.controller.ts`

**Key Decorators:**
- `@Controller('subjects')` - Defines route prefix: `/api/subjects`
- `@UseGuards(JwtAuthGuard)` - Protects all routes, validates JWT token
- `@ApiBearerAuth()` - Swagger documentation indicator
- `@Body()` - Extracts JSON from request body
- `@Param('id')` - Extracts URL path parameters
- `@Request()` - Provides full request object (includes `req.user.userId` from JWT)

**Example Implementation:**
```typescript
@Controller('subjects')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubjectsController {
  @Post()
  create(@Body() createSubjectDto: CreateSubjectDto, @Request() req) {
    // @Body() extracts JSON from request body
    // @Request() provides req.user.userId from JWT payload
    return this.subjectsService.create(createSubjectDto, req.user.userId);
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Request() req) {
    // @Param('id') extracts URL parameter
    return this.subjectsService.findOne(id, req.user.userId);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateSubjectDto: UpdateSubjectDto,
    @Request() req
  ) {
    return this.subjectsService.update(id, updateSubjectDto, req.user.userId);
  }
}
```

**Data Flow:**
1. HTTP request arrives at NestJS
2. `@Body()` decorator extracts JSON payload
3. `@Param()` decorator extracts URL parameters
4. `@Request()` provides access to JWT payload via `req.user`
5. ValidationPipe validates DTOs before controller method executes

---

### 1.2 DTO Layer - Validation Decorators

**File:** `backend/src/subjects/dto/create-subject.dto.ts`

**Validation Decorators:**
- `@ApiProperty()` - Swagger documentation
- `@IsString()` - Type validation
- `@IsNotEmpty()` - Required field validation
- `@MinLength()` / `@MaxLength()` - String length constraints
- `@Matches()` - Pattern validation (regex)
- `@IsDateString()` - ISO date string validation
- `@IsUUID()` - UUID format validation

**Complete DTO Example:**
```typescript
export class CreateSubjectDto {
  @ApiProperty({ example: 'SUB-001' })
  @IsString()
  @IsNotEmpty()
  @MinLength(3, { message: 'Subject number must be at least 3 characters' })
  @MaxLength(50, { message: 'Subject number must not exceed 50 characters' })
  @Matches(/^[A-Z0-9][A-Z0-9\-_]*[A-Z0-9]$|^[A-Z0-9]$/i, {
    message: 'Subject number must contain only letters, numbers, hyphens, and underscores'
  })
  number: string;

  @ApiProperty({ example: 'John Doe' })
  @IsString()
  @IsNotEmpty()
  name: string;

  @ApiProperty({ example: '1990-01-15' })
  @IsDateString()
  @IsNotEmpty()
  birthDate: string;

  @ApiProperty({ example: '123e4567-e89b-12d3-a456-426614174000' })
  @IsUUID()
  @IsNotEmpty()
  centerId: string;
}
```

**Global ValidationPipe Configuration:**
```typescript
// backend/src/main.ts
app.useGlobalPipes(
  new ValidationPipe({
    whitelist: true,              // Removes properties NOT in DTO
    forbidNonWhitelisted: true,   // Throws error if extra properties exist
    transform: true,              // Auto-converts types (string -> Date, etc.)
  })
);
```

**Data Transformation Example:**
```typescript
// Frontend sends:
{
  "number": "SUB-001",
  "name": "John Doe",
  "birthDate": "1990-01-15",
  "centerId": "123e4567-e89b-12d3-a456-426614174000",
  "extraField": "hack attempt"  // ❌ Rejected by forbidNonWhitelisted
}

// After ValidationPipe:
{
  number: "SUB-001",              // ✅ Validated: string, 3-50 chars, matches pattern
  name: "John Doe",               // ✅ Validated: string, not empty
  birthDate: "1990-01-15",        // ✅ Validated: ISO date string
  centerId: "123e4567-..."       // ✅ Validated: UUID format
  // extraField removed by whitelist
}
```

---

### 1.3 Service Layer - Dependency Injection Decorators

**File:** `backend/src/subjects/subjects.service.ts`

**Dependency Injection Pattern:**
```typescript
@Injectable()  // Makes this class injectable into other classes
export class SubjectsService {
  constructor(
    @InjectRepository(Subject)              // Injects TypeORM repository for Subject
    private subjectsRepository: Repository<Subject>,
    
    @InjectRepository(AuditLog)            // Injects TypeORM repository for AuditLog
    private auditLogRepository: Repository<AuditLog>,
    
    private usersService: UsersService,     // Injects UsersService
    private centersService: CentersService, // Injects CentersService
    private dataSource: DataSource,        // Injects TypeORM DataSource
  ) {}
}
```

**How NestJS Resolves Dependencies:**
1. `@Injectable()` registers service in DI container
2. `@InjectRepository(Subject)` tells NestJS to inject TypeORM repository
3. NestJS checks `SubjectsModule` for `TypeOrmModule.forFeature([Subject, AuditLog])`
4. Creates repository instances and injects them automatically

**Service Method Data Flow:**
```typescript
async create(createSubjectDto: CreateSubjectDto, userId: string): Promise<Subject> {
  // 1. Access control check
  const userCenterIds = await this.usersService.findUserCenters(userId);
  if (!userCenterIds.includes(createSubjectDto.centerId)) {
    throw new ForbiddenException('Access denied');
  }

  // 2. Data validation (duplicate check)
  const existingSubject = await this.subjectsRepository.findOne({
    where: { number: createSubjectDto.number }
  });

  // 3. Entity creation (TypeORM)
  const subject = this.subjectsRepository.create({
    number: createSubjectDto.number,
    name: createSubjectDto.name,
    birthDate: new Date(createSubjectDto.birthDate),  // String -> Date conversion
    centerId: createSubjectDto.centerId,
  });

  // 4. Database save
  const savedSubject = await this.subjectsRepository.save(subject);

  // 5. Audit log creation
  await this.createAuditLog(userId, savedSubject.id, 'CREATE', {...});

  return savedSubject;
}
```

---

### 1.4 Entity Layer - TypeORM Decorators

**File:** `backend/src/subjects/entities/subject.entity.ts`

**TypeORM Entity Decorators:**
```typescript
@Entity('subject')  // Maps to 'subject' table in database
export class Subject {
  @PrimaryGeneratedColumn('uuid')  // Auto-generates UUID on insert
  id: string;

  @Column({ type: 'varchar', length: 50, unique: true })
  number: string;

  @Column({ type: 'varchar', length: 255 })
  name: string;

  @Column({ type: 'date', name: 'birth_date' })  // Maps to 'birth_date' column
  birthDate: Date;

  @Column({ type: 'uuid', name: 'center_id' })
  centerId: string;

  @ManyToOne(() => Center, (center) => center.subjects)  // Relationship
  @JoinColumn({ name: 'center_id' })                      // Foreign key
  center: Center;
}
```

**How TypeORM Handles Data:**
```typescript
// When you call: this.subjectsRepository.save(subject)

// TypeORM Process:
// 1. Reads @Entity('subject') -> knows table name
// 2. Reads @Column() decorators -> knows column names and types
// 3. Converts TypeScript Date to PostgreSQL DATE
// 4. Converts TypeScript string (UUID) to PostgreSQL UUID
// 5. Generates SQL: INSERT INTO subject (id, number, name, birth_date, center_id) VALUES (...)
// 6. Returns entity with database-generated values
```

**Relationship Decorators:**
```typescript
@ManyToOne(() => Center, (center) => center.subjects)
// This means: Many Subjects belong to One Center
// TypeORM uses this to:
// - Join tables when loading relations
// - Validate foreign key constraints
// - Eager/lazy load related data

// Usage:
const subject = await this.subjectsRepository.find({
  where: { id },
  relations: ['center']  // Tells TypeORM to JOIN center table
});
// Result: subject.center.name is available
```

**Audit Log Entity:**
```typescript
@Entity('audit_log')
export class AuditLog {
  @PrimaryGeneratedColumn('uuid')
  id: string;

  @Column({ type: 'uuid', name: 'subject_id', nullable: true })
  subjectId: string | null;

  @Column({ type: 'uuid', name: 'user_id', nullable: true })
  userId: string | null;

  @Column({ type: 'varchar', length: 50 })
  action: string;

  @Column({ type: 'jsonb', default: {} })  // PostgreSQL JSONB for flexible structure
  diff: Record<string, any>;

  @CreateDateColumn({ type: 'timestamptz', name: 'timestamp' })
  timestamp: Date;

  @ManyToOne(() => Subject, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'subject_id' })
  subject: Subject | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL' })
  @JoinColumn({ name: 'user_id' })
  user: User | null;
}
```

---

### 1.5 Module Decorators - Dependency Wiring

**File:** `backend/src/subjects/subjects.module.ts`

**Module Configuration:**
```typescript
@Module({
  imports: [
    TypeOrmModule.forFeature([Subject, AuditLog]),  // Registers entities for DI
    UsersModule,                                    // Imports UsersModule
    CentersModule,                                  // Imports CentersModule
  ],
  controllers: [SubjectsController],               // Registers controller
  providers: [SubjectsService],                    // Registers service
  exports: [SubjectsService],                      // Exports for other modules
})
export class SubjectsModule {}
```

**What `TypeOrmModule.forFeature([Subject, AuditLog])` Does:**
- Registers `Repository<Subject>` and `Repository<AuditLog>` in DI container
- Enables `@InjectRepository(Subject)` to work
- Scopes repositories to this module
- Provides type-safe database access

---

### 1.6 Authentication Decorators

**File:** `backend/src/auth/strategies/jwt.strategy.ts`

**JWT Strategy:**
```typescript
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy) {
  constructor(private usersService: UsersService) {
    super({
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      ignoreExpiration: false,
      secretOrKey: process.env.JWT_SECRET || 'your-secret-key',
    });
  }

  async validate(payload: any) {
    const user = await this.usersService.findOne(payload.sub);
    if (!user) {
      throw new UnauthorizedException();
    }
    return { userId: user.id, username: user.username };
    // This object is attached to req.user
  }
}
```

**Guard Usage:**
```typescript
@UseGuards(JwtAuthGuard)  // Validates JWT token on every request
@Controller('subjects')
export class SubjectsController {
  // All methods protected by JWT authentication
}
```

---

<a name="angular-decorators"></a>
## Section 2: Angular Decorators - Frontend Data Handling

### 2.1 Component Decorators

**File:** `frontend/src/app/features/subjects/subjects-list/subjects-list.component.ts`

**Component Definition:**
```typescript
@Component({
  selector: 'app-subjects-list',  // HTML tag: <app-subjects-list>
  standalone: true,               // Angular 20: no NgModule needed
  imports: [CommonModule, FormsModule],  // Direct imports
  template: `...`,                // Inline template
  styles: [`...`]                  // Inline styles
})
export class SubjectsListComponent implements OnInit {
  subjects: Subject[] = [];       // Component state
  loading = false;
  
  constructor(
    private subjectsService: SubjectsService,  // Injected service
    private centersService: CentersService
  ) {}
  
  ngOnInit() {                    // Lifecycle hook
    this.loadSubjects();
  }
}
```

**Key Points:**
- `@Component()` registers component with Angular
- `standalone: true` makes it self-contained (Angular 20 feature)
- `imports: [CommonModule, FormsModule]` provides directives (`*ngFor`, `*ngIf`, `[(ngModel)]`)
- Constructor injection provides services automatically

---

### 2.2 Service Decorators - Dependency Injection

**File:** `frontend/src/app/core/services/subjects.service.ts`

**Service Definition:**
```typescript
@Injectable({
  providedIn: 'root'  // Singleton service available app-wide
})
export class SubjectsService {
  private apiUrl = 'http://localhost:3000/api';

  constructor(private http: HttpClient) {}  // HttpClient injected by Angular

  getAll(): Observable<Subject[]> {
    return this.http.get<Subject[]>(`${this.apiUrl}/subjects`);
    // Generic <Subject[]> provides type safety
  }

  create(subject: CreateSubjectDto): Observable<Subject> {
    return this.http.post<Subject>(`${this.apiUrl}/subjects`, subject);
    // POST sends JSON body, returns typed Observable
  }

  update(id: string, subject: UpdateSubjectDto): Observable<Subject> {
    return this.http.patch<Subject>(`${this.apiUrl}/subjects/${id}`, subject);
  }

  delete(id: string): Observable<void> {
    return this.http.delete<void>(`${this.apiUrl}/subjects/${id}`);
  }

  getAuditLogs(id: string): Observable<any[]> {
    return this.http.get<any[]>(`${this.apiUrl}/subjects/${id}/audit-logs`);
  }
}
```

**What `providedIn: 'root'` Means:**
- Service is a singleton (one instance for entire app)
- Angular creates instance automatically
- Any component can inject it
- No need to add to providers array

**Auth Service Example:**
```typescript
@Injectable({
  providedIn: 'root'
})
export class AuthService {
  private apiUrl = 'http://localhost:3000/api';
  private currentUserSubject = new BehaviorSubject<User | null>(null);
  public currentUser$ = this.currentUserSubject.asObservable();

  constructor(private http: HttpClient) {
    // Restore user from localStorage on service initialization
    const token = localStorage.getItem('token');
    const userStr = localStorage.getItem('user');
    if (token && userStr) {
      this.currentUserSubject.next(JSON.parse(userStr));
    }
  }

  login(username: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.apiUrl}/auth/login`, {
      username,
      password,
    }).pipe(
      tap((response) => {
        localStorage.setItem('token', response.access_token);
        localStorage.setItem('user', JSON.stringify(response.user));
        this.currentUserSubject.next(response.user);
      })
    );
  }

  logout(): void {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
    this.currentUserSubject.next(null);
  }

  getToken(): string | null {
    return localStorage.getItem('token');
  }

  isAuthenticated(): boolean {
    return !!this.getToken();
  }
}
```

---

### 2.3 HTTP Interceptor - Request Transformation

**File:** `frontend/src/app/core/interceptors/auth.interceptor.ts`

**Functional Interceptor (Angular 20):**
```typescript
export const authInterceptor: HttpInterceptorFn = (req, next) => {
  const authService = inject(AuthService);  // inject() function
  const token = authService.getToken();

  if (token) {
    req = req.clone({                       // Clone request (immutable)
      setHeaders: {
        Authorization: `Bearer ${token}`,   // Add JWT token
      },
    });
  }

  return next(req);  // Pass modified request to next handler
};
```

**Registration in `main.ts`:**
```typescript
import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { authInterceptor } from './app/core/interceptors/auth.interceptor';

bootstrapApplication(AppComponent, {
  providers: [
    provideRouter(routes),
    provideHttpClient(
      withInterceptors([authInterceptor])  // Registers interceptor
    ),
  ],
});
```

**Data Flow:**
```typescript
// Component calls:
this.subjectsService.getAll()

// 1. SubjectsService creates HTTP request
this.http.get<Subject[]>('http://localhost:3000/api/subjects')

// 2. authInterceptor intercepts request
//    - Reads token from AuthService
//    - Clones request with Authorization header

// 3. HTTP request sent:
GET http://localhost:3000/api/subjects
Headers: {
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
}

// 4. Backend receives request
//    - JwtAuthGuard validates token
//    - Extracts userId from token payload
//    - Attaches to req.user
```

---

### 2.4 Route Guard - Access Control

**File:** `frontend/src/app/core/guards/auth.guard.ts`

**Functional Guard (Angular 20):**
```typescript
export const authGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  if (authService.isAuthenticated()) {
    return true;  // Allow navigation
  }

  router.navigate(['/login']);  // Redirect to login
  return false;                  // Block navigation
};
```

**Route Configuration:**
```typescript
export const routes: Routes = [
  {
    path: 'login',
    loadComponent: () => import('./features/login/login.component').then(m => m.LoginComponent),
  },
  {
    path: 'subjects',
    loadComponent: () => import('./features/subjects/subjects-list/subjects-list.component').then(m => m.SubjectsListComponent),
    canActivate: [authGuard],  // Guard runs before component loads
  },
  {
    path: 'centers',
    loadComponent: () => import('./features/centers/centers-list/centers-list.component').then(m => m.CentersListComponent),
    canActivate: [authGuard],
  },
];
```

**Guard Execution Flow:**
1. User navigates to `/subjects`
2. Router checks `canActivate: [authGuard]`
3. Guard checks `localStorage.getItem('token')`
4. If no token → redirect to `/login`
5. If token exists → load component

---

### 2.5 Component Data Handling

**Loading Data:**
```typescript
loadSubjects() {
  this.loading = true;
  this.error = '';
  this.subjectsService.getAll().subscribe({
    next: (subjects: Subject[]) => {
      // Transform data if needed
      this.subjects = subjects.map((subject) => {
        return {
          ...subject,
          centerId: subject.centerId || subject.center?.id || '',
          center: subject.center,
        };
      });
      this.loading = false;
    },
    error: (err) => {
      this.error = err.error?.message || 'Failed to load subjects';
      this.loading = false;
    },
  });
}
```

**Creating/Updating:**
```typescript
saveSubject() {
  this.formError = '';
  this.saving = true;

  const subjectData = {
    number: this.formData.number,
    name: this.formData.name,
    birthDate: this.formData.birthDate,  // ISO date string
    centerId: this.formData.centerId,
  };

  const operation = this.editingSubject
    ? this.subjectsService.update(this.editingSubject.id, subjectData)
    : this.subjectsService.create(subjectData);

  operation.subscribe({
    next: (updatedSubject) => {
      this.saving = false;
      this.closeModal();
      
      // Reload to get fresh data (especially important for center changes)
      setTimeout(() => {
        this.loadSubjects();
        this.loadCenters();
      }, 100);
    },
    error: (err) => {
      this.formError = err.error?.message || 'Failed to save subject';
      this.saving = false;
    },
  });
}
```

---

<a name="complete-data-flow"></a>
## Section 3: Complete Data Flow - End to End

### 3.1 Creating a Subject - Full Pipeline

**Step 1: Angular Component (User Input)**
```typescript
// User fills form, clicks "Save"
saveSubject() {
  const subjectData = {
    number: this.formData.number,      // "SUB-001"
    name: this.formData.name,           // "John Doe"
    birthDate: this.formData.birthDate, // "1990-01-15" (ISO string)
    centerId: this.formData.centerId,   // UUID string
  };

  this.subjectsService.create(subjectData).subscribe({...});
}
```

**Step 2: Angular Service (HTTP Request)**
```typescript
// subjects.service.ts
create(subject: CreateSubjectDto): Observable<Subject> {
  return this.http.post<Subject>(`${this.apiUrl}/subjects`, subject);
  // Sends: POST /api/subjects
  // Body: { number: "SUB-001", name: "John Doe", ... }
}
```

**Step 3: HTTP Interceptor (Adds Token)**
```typescript
// auth.interceptor.ts
req = req.clone({
  setHeaders: {
    Authorization: `Bearer ${token}`,  // Adds JWT token
  },
});
// Request now has: Authorization: Bearer eyJhbGc...
```

**Step 4: NestJS Controller (Receives Request)**
```typescript
// subjects.controller.ts
@Post()
@UseGuards(JwtAuthGuard)  // Validates JWT token
create(@Body() createSubjectDto: CreateSubjectDto, @Request() req) {
  // @Body() extracts: { number: "SUB-001", name: "John Doe", ... }
  // @Request() provides: req.user.userId (from JWT payload)
  return this.subjectsService.create(createSubjectDto, req.user.userId);
}
```

**Step 5: ValidationPipe (Validates DTO)**
```typescript
// ValidationPipe runs BEFORE controller method
// Checks:
// - @IsString() on number ✅
// - @IsNotEmpty() on name ✅
// - @IsDateString() on birthDate ✅
// - @IsUUID() on centerId ✅
// - @Matches() pattern on number ✅
// If validation fails → 400 Bad Request
// If passes → continues to service
```

**Step 6: NestJS Service (Business Logic)**
```typescript
// subjects.service.ts
async create(createSubjectDto: CreateSubjectDto, userId: string) {
  // 1. Access control
  const userCenterIds = await this.usersService.findUserCenters(userId);
  
  // 2. TypeORM entity creation
  const subject = this.subjectsRepository.create({
    number: createSubjectDto.number,
    name: createSubjectDto.name,
    birthDate: new Date(createSubjectDto.birthDate),  // String → Date
    centerId: createSubjectDto.centerId,
  });
  
  // 3. Database save
  const savedSubject = await this.subjectsRepository.save(subject);
  // TypeORM generates: INSERT INTO subject (...)
  // Returns: { id: "uuid", number: "SUB-001", ... }
  
  // 4. Audit log
  await this.createAuditLog(userId, savedSubject.id, 'CREATE', {...});
  
  return savedSubject;
}
```

**Step 7: TypeORM Entity Mapping**
```typescript
// TypeORM reads @Entity('subject') decorator
// Maps TypeScript object to SQL:
{
  id: "uuid",                    // @PrimaryGeneratedColumn('uuid')
  number: "SUB-001",             // @Column({ type: 'varchar' })
  name: "John Doe",              // @Column({ type: 'varchar' })
  birthDate: Date("1990-01-15"), // @Column({ type: 'date' })
  centerId: "uuid"               // @Column({ type: 'uuid' })
}

// Converts to SQL:
INSERT INTO subject (id, number, name, birth_date, center_id)
VALUES (gen_random_uuid(), 'SUB-001', 'John Doe', '1990-01-15', 'uuid');
```

**Step 8: Response Back to Angular**
```typescript
// Backend returns: { id: "uuid", number: "SUB-001", ... }
// Angular service receives Observable<Subject>
// Component subscribes:
.subscribe({
  next: (updatedSubject) => {
    this.loadSubjects();  // Reload list
  }
});
```

---

### 3.2 Reading Subjects - Query with Access Control

**Step 1: Component Requests Data**
```typescript
loadSubjects() {
  this.subjectsService.getAll().subscribe({
    next: (subjects: Subject[]) => {
      this.subjects = subjects;
    }
  });
}
```

**Step 2: Service Makes HTTP Request**
```typescript
getAll(): Observable<Subject[]> {
  return this.http.get<Subject[]>(`${this.apiUrl}/subjects`);
  // GET /api/subjects
  // Headers: Authorization: Bearer <token>
}
```

**Step 3: Controller Receives Request**
```typescript
@Get()
findAll(@Request() req) {
  return this.subjectsService.findAll(req.user.userId);
  // Extracts userId from JWT token (via @Request())
}
```

**Step 4: Service Filters by User Centers**
```typescript
async findAll(userId: string): Promise<Subject[]> {
  // 1. Get user's accessible centers
  const userCenterIds = await this.usersService.findUserCenters(userId);
  // Returns: ["center-uuid-1", "center-uuid-2"]
  
  // 2. Query only subjects from those centers
  return this.subjectsRepository.find({
    where: userCenterIds.map((centerId) => ({ centerId })),
    // TypeORM generates: WHERE center_id IN ('uuid1', 'uuid2')
    relations: ['center'],  // JOIN center table
    order: { number: 'ASC' },
  });
}
```

**Step 5: TypeORM Query Execution**
```typescript
// TypeORM generates SQL:
SELECT 
  subject.id, 
  subject.number, 
  subject.name, 
  subject.birth_date, 
  subject.center_id,
  center.id AS center_id,
  center.name AS center_name
FROM subject
LEFT JOIN center ON subject.center_id = center.id
WHERE subject.center_id IN ('uuid1', 'uuid2')
ORDER BY subject.number ASC;

// TypeORM maps result to TypeScript objects:
[
  {
    id: "uuid",
    number: "SUB-001",
    name: "John Doe",
    birthDate: Date("1990-01-15"),
    centerId: "center-uuid",
    center: { id: "center-uuid", name: "Center A" }  // From JOIN
  }
]
```

**Step 6: Response to Angular**
```typescript
// Backend returns JSON array
// Angular HttpClient deserializes to Subject[] objects
// Component receives typed array
this.subjects = [
  {
    id: "uuid",
    number: "SUB-001",
    name: "John Doe",
    birthDate: "1990-01-15T00:00:00.000Z",  // ISO string
    centerId: "center-uuid",
    center: { id: "center-uuid", name: "Center A" }
  }
];
```

---

### 3.3 Update Operation - Diff Calculation

**Update Method with Diff:**
```typescript
async update(id: string, updateSubjectDto: UpdateSubjectDto, userId: string) {
  // 1. Load existing subject
  const subject = await this.findOne(id, userId);
  const oldData = {
    number: subject.number,
    name: subject.name,
    birthDate: subject.birthDate,
    centerId: subject.centerId,
  };
  
  // 2. Apply updates
  Object.assign(subject, updateSubjectDto);
  const updatedSubject = await this.subjectsRepository.save(subject);
  
  // 3. Calculate diff (only changed fields)
  const diff: Record<string, any> = {};
  
  if (updateSubjectDto.number !== oldData.number) {
    diff.number = { old: oldData.number, new: updateSubjectDto.number };
  }
  
  if (updateSubjectDto.name !== oldData.name) {
    diff.name = { old: oldData.name, new: updateSubjectDto.name };
  }
  
  if (updateSubjectDto.birthDate) {
    const newBirthDateStr = updateSubjectDto.birthDate;
    const oldBirthDateStr = oldBirthDate.toISOString().split('T')[0];
    if (newBirthDateStr !== oldBirthDateStr) {
      diff.birthDate = {
        old: oldBirthDateStr,
        new: newBirthDateStr,
      };
    }
  }
  
  if (updateSubjectDto.centerId && updateSubjectDto.centerId !== oldData.centerId) {
    const oldCenter = await this.centersService.findOne(oldData.centerId, userId);
    const newCenter = await this.centersService.findOne(updateSubjectDto.centerId, userId);
    
    diff.center = {
      old: { id: oldData.centerId, name: oldCenter?.name || 'Unknown' },
      new: { id: updateSubjectDto.centerId, name: newCenter?.name || 'Unknown' }
    };
  }
  
  // 4. Save audit log with diff
  if (Object.keys(diff).length > 0) {
    await this.createAuditLog(userId, id, 'UPDATE', {
      ...diff,
      subjectId: id,
    });
  }
  
  return updatedSubject;
}
```

**Audit Log Diff Structure:**
```typescript
// Example diff stored in JSONB:
{
  "number": { "old": "SUB-001", "new": "SUB-002" },
  "name": { "old": "John Doe", "new": "Jane Doe" },
  "birthDate": { "old": "1990-01-15", "new": "1991-01-15" },
  "center": {
    "old": { "id": "uuid1", "name": "Center A" },
    "new": { "id": "uuid2", "name": "Center B" }
  },
  "subjectId": "subject-uuid"
}
```

---

<a name="advanced-patterns"></a>
## Section 4: Advanced Data Handling Patterns

### 4.1 Partial Updates with DTOs

**Update DTO:**
```typescript
// backend/src/subjects/dto/update-subject.dto.ts
export class UpdateSubjectDto extends PartialType(CreateSubjectDto) {}
```

**What `PartialType` Does:**
- Makes all properties optional
- Inherits validation decorators from `CreateSubjectDto`
- Allows partial updates (PATCH semantics)

**Usage Example:**
```typescript
// Frontend can send:
{
  "name": "New Name"  // Only name, other fields unchanged
}

// Or:
{
  "name": "New Name",
  "birthDate": "1991-01-15"
}

// All fields are optional, validation still applies
```

---

### 4.2 Date Handling - String to Date Conversion

**Frontend → Backend:**
```typescript
// Angular: HTML date input
<input type="date" [(ngModel)]="formData.birthDate" />
// Value: "1990-01-15" (ISO date string)

// HTTP request
POST /api/subjects
Body: { "birthDate": "1990-01-15" }

// Backend DTO validation
@IsDateString()  // Validates ISO date string format
birthDate: string;

// Service layer conversion
birthDate: new Date(createSubjectDto.birthDate)
// Converts: "1990-01-15" → Date object

// TypeORM entity
@Column({ type: 'date' })
birthDate: Date;

// Database storage
// PostgreSQL DATE type: '1990-01-15'
```

**Backend → Frontend:**
```typescript
// Database returns: Date object
birthDate: Date("1990-01-15")

// TypeORM serializes to JSON
// Date → ISO string: "1990-01-15T00:00:00.000Z"

// Angular receives
birthDate: "1990-01-15T00:00:00.000Z"

// Component displays
formatDate(dateString: string): string {
  if (!dateString) return '';
  const date = new Date(dateString);
  return date.toLocaleString();
}
```

---

### 4.3 Access Control Implementation

**User-Center Relationship:**
```typescript
// Entity: user_center (many-to-many)
@Entity('user_center')
export class UserCenter {
  @PrimaryColumn({ type: 'uuid', name: 'user_id' })
  userId: string;

  @PrimaryColumn({ type: 'uuid', name: 'center_id' })
  centerId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'user_id' })
  user: User;

  @ManyToOne(() => Center, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'center_id' })
  center: Center;
}
```

**Access Control in Service:**
```typescript
async findAll(userId: string): Promise<Subject[]> {
  // Get user's accessible centers
  const userCenterIds = await this.usersService.findUserCenters(userId);
  if (userCenterIds.length === 0) {
    return [];  // No access
  }
  
  // Query only subjects from user's centers
  return this.subjectsRepository.find({
    where: userCenterIds.map((centerId) => ({ centerId })),
    relations: ['center'],
    order: { number: 'ASC' },
  });
}

async findOne(id: string, userId: string): Promise<Subject> {
  const subject = await this.subjectsRepository.findOne({
    where: { id },
    relations: ['center'],
  });
  
  if (!subject) {
    throw new NotFoundException(`Subject with ID ${id} not found`);
  }

  // Check access
  const userCenterIds = await this.usersService.findUserCenters(userId);
  if (!userCenterIds.includes(subject.centerId)) {
    throw new ForbiddenException('Access denied to this subject');
  }

  return subject;
}
```

---

### 4.4 Audit Logging for Deleted Subjects

**Complex Query Logic:**
```typescript
async getAuditLogs(subjectIdOrNumber: string, userId: string): Promise<AuditLog[]> {
  // Can accept UUID or subject number
  const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(subjectIdOrNumber);
  
  let subjectId: string | null = null;
  
  if (isUUID) {
    subjectId = subjectIdOrNumber;
  } else {
    // Try to find subject by number
    const subject = await this.subjectsRepository.findOne({
      where: { number: subjectIdOrNumber },
    });
    
    if (subject) {
      subjectId = subject.id;
    } else {
      // Subject deleted - find in audit logs
      const anyLogWithNumber = await this.auditLogRepository
        .createQueryBuilder('audit_log')
        .where("audit_log.diff->>'number' = :number", { number: subjectIdOrNumber })
        .orWhere("audit_log.diff->'number'->>'new' = :number", { number: subjectIdOrNumber })
        .orderBy('audit_log.timestamp', 'ASC')
        .getOne();
      
      if (anyLogWithNumber && anyLogWithNumber.subjectId) {
        subjectId = anyLogWithNumber.subjectId;
      }
    }
  }

  // Query audit logs
  let auditLogs: AuditLog[] = [];
  
  if (subjectId) {
    auditLogs = await this.auditLogRepository
      .createQueryBuilder('audit_log')
      .leftJoinAndSelect('audit_log.user', 'user')
      .where('audit_log.subject_id = :subjectId', { subjectId })
      .orWhere("audit_log.diff->>'subjectId' = :subjectId::text", { subjectId })
      .orderBy('audit_log.timestamp', 'DESC')
      .getMany();
  }
  
  // Verify access control
  const userCenterIds = await this.usersService.findUserCenters(userId);
  // ... access control logic ...
  
  return auditLogs;
}
```

---

<a name="decorator-summary"></a>
## Section 5: Key Decorator Patterns Summary

### NestJS Decorators

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@Controller()` | Route definition | `@Controller('subjects')` |
| `@Get()`, `@Post()`, `@Patch()`, `@Delete()` | HTTP methods | `@Post()` |
| `@Body()` | Extract request body | `@Body() dto: CreateSubjectDto` |
| `@Param()` | Extract URL parameter | `@Param('id') id: string` |
| `@Request()` | Access full request | `@Request() req` |
| `@UseGuards()` | Authentication/authorization | `@UseGuards(JwtAuthGuard)` |
| `@Injectable()` | Dependency injection | `@Injectable()` |
| `@InjectRepository()` | TypeORM repository injection | `@InjectRepository(Subject)` |
| `@Entity()` | Database table mapping | `@Entity('subject')` |
| `@Column()` | Database column mapping | `@Column({ type: 'varchar' })` |
| `@PrimaryGeneratedColumn()` | Primary key | `@PrimaryGeneratedColumn('uuid')` |
| `@ManyToOne()`, `@OneToMany()` | Relationships | `@ManyToOne(() => Center)` |
| `@IsString()`, `@IsNotEmpty()` | Validation | `@IsString() @IsNotEmpty()` |
| `@IsUUID()`, `@IsDateString()` | Type validation | `@IsUUID()` |
| `@MinLength()`, `@MaxLength()` | Length validation | `@MinLength(3)` |
| `@Matches()` | Pattern validation | `@Matches(/pattern/)` |
| `@Module()` | Module configuration | `@Module({ imports: [...] })` |
| `@ApiProperty()` | Swagger documentation | `@ApiProperty({ example: 'SUB-001' })` |

### Angular Decorators

| Decorator | Purpose | Example |
|-----------|---------|---------|
| `@Component()` | Component definition | `@Component({ selector: 'app-subject' })` |
| `@Injectable()` | Service registration | `@Injectable({ providedIn: 'root' })` |
| Functional Interceptors | Request/response transformation | `HttpInterceptorFn` |
| Functional Guards | Route protection | `CanActivateFn` |

### Data Transformation Points

1. **HTTP Request** → `@Body()` extracts JSON
2. **ValidationPipe** → Validates and transforms DTOs
3. **Service Layer** → Business logic and access control
4. **TypeORM** → TypeScript objects ↔ SQL queries
5. **Database** → Stores data with constraints
6. **HTTP Response** → JSON serialization
7. **Angular HttpClient** → Deserializes JSON to TypeScript objects
8. **Component** → Displays data in UI

---

## Conclusion

This document demonstrates precise data handling using decorators in both NestJS and Angular:

- **NestJS decorators** handle request extraction, validation, dependency injection, and database mapping
- **Angular decorators** handle component lifecycle, service injection, HTTP interception, and route protection
- **TypeORM decorators** map TypeScript entities to database tables with relationships
- **Validation decorators** ensure data integrity at API boundaries
- **Complete data flow** from user input to database and back, with type safety throughout

The decorator pattern provides a declarative, type-safe approach to data handling that reduces boilerplate and improves maintainability.

---

**Document Version:** 1.0  
**Last Updated:** 2024  
**Project:** Subjects App - Clinical Trial Management System

