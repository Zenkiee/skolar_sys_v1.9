using Microsoft.EntityFrameworkCore;
using inMVC.Models;

namespace inMVC.Data;

public class AppDbContext : DbContext
{
    public AppDbContext(DbContextOptions<AppDbContext> options) : base(options) { }

    public DbSet<User> Users { get; set; }
    public DbSet<LearnerProfile> LearnerProfiles { get; set; }  
    public DbSet<TutorProfile> TutorProfiles { get; set; } 
    public DbSet<Booking> Bookings { get; set; }
    public DbSet<Review> Reviews { get; set; }
    public DbSet<ReviewReport> ReviewReports { get; set; }
    public DbSet<TutorAvailability> TutorAvailabilities { get; set; }
    public DbSet<TutorNotificationSettings> TutorNotificationSettings { get; set; }
    public DbSet<PaymentTransaction> PaymentTransactions { get; set; }
    public DbSet<RefundTransaction> RefundTransactions { get; set; }
    public DbSet<CancellationRecord> CancellationRecords { get; set; }
    public DbSet<DiscountVoucher> DiscountVouchers { get; set; }
    public DbSet<TutorPenalty> TutorPenalties { get; set; }
    public DbSet<PaymentWebhookEvent> PaymentWebhookEvents { get; set; }
    public DbSet<TutorPayout> TutorPayouts { get; set; }

    protected override void OnModelCreating(ModelBuilder modelBuilder)
    {
        base.OnModelCreating(modelBuilder);

        modelBuilder.Entity<Review>()
            .HasIndex(review => review.BookingId)
            .IsUnique();

        modelBuilder.Entity<ReviewReport>()
            .HasIndex(report => new { report.ReviewId, report.TutorId })
            .IsUnique();

        modelBuilder.Entity<TutorNotificationSettings>()
            .HasIndex(settings => settings.TutorId)
            .IsUnique();

        modelBuilder.Entity<PaymentTransaction>()
            .HasIndex(transaction => transaction.ExternalPaymentId)
            .IsUnique();

        modelBuilder.Entity<PaymentWebhookEvent>()
            .HasIndex(item => item.ExternalEventId)
            .IsUnique();

        modelBuilder.Entity<DiscountVoucher>()
            .HasIndex(voucher => voucher.Code)
            .IsUnique();
    }
}