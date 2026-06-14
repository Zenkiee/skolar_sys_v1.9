using inMVC.Data;
using Microsoft.EntityFrameworkCore;
using System.Text.Json;
using inMVC.Services;
using inMVC.Models;

var builder = WebApplication.CreateBuilder(args);

builder.Services.AddDbContext<AppDbContext>(options =>
    options.UseSqlite("Data Source=skolar.db"));

builder.Services.AddControllersWithViews()
    .AddJsonOptions(options => {
        options.JsonSerializerOptions.PropertyNameCaseInsensitive = true;
        options.JsonSerializerOptions.PropertyNamingPolicy = JsonNamingPolicy.CamelCase;
    });

builder.Services.AddEndpointsApiExplorer();

builder.Services.AddHttpClient();
builder.Services.AddScoped<IPaymentGateway, PayMongoGateway>();
builder.Services.AddScoped<PaymentService>();
builder.Services.AddHttpContextAccessor();

builder.Services.AddAntiforgery(options =>
{
    options.HeaderName = "X-CSRF-TOKEN";
});

builder.Services.AddSession(options =>
{
    options.IdleTimeout = TimeSpan.FromHours(8);
    options.Cookie.HttpOnly = true;
    options.Cookie.IsEssential = true;
});

var app = builder.Build();

using (var scope = app.Services.CreateScope())
{
    var services = scope.ServiceProvider;
    var database = services.GetRequiredService<AppDbContext>();
    var configuration = services.GetRequiredService<IConfiguration>();

    await database.Database.MigrateAsync();

    var adminName = configuration["AdminCredentials:Name"] ?? "Skolar Administrator";
    var adminEmail = (configuration["AdminCredentials:Email"] ?? "skolartutors.ph@gmail.com")
        .Trim()
        .ToLowerInvariant();
    var adminPassword = configuration["AdminCredentials:Password"] ?? "admin_132";

    var admin = await database.Users
        .FirstOrDefaultAsync(user => user.Role == "admin");

    admin ??= await database.Users
        .FirstOrDefaultAsync(user => user.Email.ToLower() == adminEmail);

    if (admin == null)
    {
        admin = new User();
        database.Users.Add(admin);
    }

    admin.Name = adminName;
    admin.Email = adminEmail;
    admin.Role = "admin";

    if (string.IsNullOrWhiteSpace(admin.PasswordHash) ||
        !BCrypt.Net.BCrypt.Verify(adminPassword, admin.PasswordHash))
    {
        admin.PasswordHash = BCrypt.Net.BCrypt.HashPassword(adminPassword);
    }

    await database.SaveChangesAsync();
}


if (!app.Environment.IsDevelopment())
{
    app.UseExceptionHandler("/Home/Error");
    app.UseHsts();
}

app.UseHttpsRedirection();
app.UseStaticFiles();
app.UseRouting();
app.UseSession();
app.UseAuthorization();

app.MapControllerRoute(
    name: "default",
    pattern: "{controller=Home}/{action=Index}/{id?}");

app.Run();