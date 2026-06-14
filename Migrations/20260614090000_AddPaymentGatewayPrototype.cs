using System;
using Microsoft.EntityFrameworkCore.Infrastructure;
using Microsoft.EntityFrameworkCore.Migrations;
using inMVC.Data;

#nullable disable

namespace inMVC.Migrations;

[DbContext(typeof(AppDbContext))]
[Migration("20260614090000_AddPaymentGatewayPrototype")]
public partial class AddPaymentGatewayPrototype : Migration
{
    protected override void Up(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.AddColumn<DateTime>(name: "CancelledAt", table: "Bookings", type: "TEXT", nullable: true);
        migrationBuilder.AddColumn<string>(name: "CancelledByRole", table: "Bookings", type: "TEXT", nullable: false, defaultValue: "");
        migrationBuilder.AddColumn<decimal>(name: "DurationHours", table: "Bookings", type: "TEXT", nullable: false, defaultValue: 0m);
        migrationBuilder.AddColumn<decimal>(name: "HourlyRate", table: "Bookings", type: "TEXT", nullable: false, defaultValue: 0m);
        migrationBuilder.AddColumn<string>(name: "PaymentStatus", table: "Bookings", type: "TEXT", nullable: false, defaultValue: "Unpaid");
        migrationBuilder.AddColumn<int>(name: "PaymentTransactionId", table: "Bookings", type: "INTEGER", nullable: true);
        migrationBuilder.AddColumn<decimal>(name: "SessionAmount", table: "Bookings", type: "TEXT", nullable: false, defaultValue: 0m);

        migrationBuilder.CreateTable(
            name: "CancellationRecords",
            columns: table => new
            {
                Id = table.Column<int>(type: "INTEGER", nullable: false).Annotation("Sqlite:Autoincrement", true),
                BookingId = table.Column<int>(type: "INTEGER", nullable: false),
                LearnerId = table.Column<int>(type: "INTEGER", nullable: false),
                TutorId = table.Column<int>(type: "INTEGER", nullable: false),
                RequestedByRole = table.Column<string>(type: "TEXT", nullable: false),
                HoursBeforeSession = table.Column<decimal>(type: "TEXT", nullable: false),
                RefundPercentage = table.Column<decimal>(type: "TEXT", nullable: false),
                RefundAmount = table.Column<decimal>(type: "TEXT", nullable: false),
                RetainedAmount = table.Column<decimal>(type: "TEXT", nullable: false),
                TutorCompensationAmount = table.Column<decimal>(type: "TEXT", nullable: false),
                LearnerVoucherPercentage = table.Column<decimal>(type: "TEXT", nullable: false),
                LearnerVoucherAmount = table.Column<decimal>(type: "TEXT", nullable: false),
                TutorFinePercentage = table.Column<decimal>(type: "TEXT", nullable: false),
                WarningIssued = table.Column<bool>(type: "INTEGER", nullable: false),
                RuleCode = table.Column<string>(type: "TEXT", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_CancellationRecords", x => x.Id));

        migrationBuilder.CreateTable(
            name: "DiscountVouchers",
            columns: table => new
            {
                Id = table.Column<int>(type: "INTEGER", nullable: false).Annotation("Sqlite:Autoincrement", true),
                LearnerId = table.Column<int>(type: "INTEGER", nullable: false),
                SourceBookingId = table.Column<int>(type: "INTEGER", nullable: false),
                Code = table.Column<string>(type: "TEXT", nullable: false),
                Percentage = table.Column<decimal>(type: "TEXT", nullable: false),
                MaximumAmount = table.Column<decimal>(type: "TEXT", nullable: false),
                Status = table.Column<string>(type: "TEXT", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                ExpiresAt = table.Column<DateTime>(type: "TEXT", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_DiscountVouchers", x => x.Id));

        migrationBuilder.CreateTable(
            name: "PaymentTransactions",
            columns: table => new
            {
                Id = table.Column<int>(type: "INTEGER", nullable: false).Annotation("Sqlite:Autoincrement", true),
                LearnerId = table.Column<int>(type: "INTEGER", nullable: false),
                BookingGroupId = table.Column<string>(type: "TEXT", nullable: false),
                Provider = table.Column<string>(type: "TEXT", nullable: false),
                ExternalPaymentId = table.Column<string>(type: "TEXT", nullable: false),
                CheckoutReference = table.Column<string>(type: "TEXT", nullable: false),
                PaymentMethod = table.Column<string>(type: "TEXT", nullable: false),
                Amount = table.Column<decimal>(type: "TEXT", nullable: false),
                Currency = table.Column<string>(type: "TEXT", nullable: false),
                Status = table.Column<string>(type: "TEXT", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                PaidAt = table.Column<DateTime>(type: "TEXT", nullable: true)
            },
            constraints: table => table.PrimaryKey("PK_PaymentTransactions", x => x.Id));

        migrationBuilder.CreateTable(
            name: "PaymentWebhookEvents",
            columns: table => new
            {
                Id = table.Column<int>(type: "INTEGER", nullable: false).Annotation("Sqlite:Autoincrement", true),
                Provider = table.Column<string>(type: "TEXT", nullable: false),
                ExternalEventId = table.Column<string>(type: "TEXT", nullable: false),
                EventType = table.Column<string>(type: "TEXT", nullable: false),
                Payload = table.Column<string>(type: "TEXT", nullable: false),
                ProcessedAt = table.Column<DateTime>(type: "TEXT", nullable: false)
            },
            constraints: table => table.PrimaryKey("PK_PaymentWebhookEvents", x => x.Id));

        migrationBuilder.CreateTable(
            name: "RefundTransactions",
            columns: table => new
            {
                Id = table.Column<int>(type: "INTEGER", nullable: false).Annotation("Sqlite:Autoincrement", true),
                PaymentTransactionId = table.Column<int>(type: "INTEGER", nullable: false),
                BookingId = table.Column<int>(type: "INTEGER", nullable: false),
                ExternalRefundId = table.Column<string>(type: "TEXT", nullable: false),
                Amount = table.Column<decimal>(type: "TEXT", nullable: false),
                Currency = table.Column<string>(type: "TEXT", nullable: false),
                Status = table.Column<string>(type: "TEXT", nullable: false),
                Reason = table.Column<string>(type: "TEXT", nullable: false),
                RequestedByRole = table.Column<string>(type: "TEXT", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                UpdatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                CompletedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
            },
            constraints: table => table.PrimaryKey("PK_RefundTransactions", x => x.Id));

        migrationBuilder.CreateTable(
            name: "TutorPenalties",
            columns: table => new
            {
                Id = table.Column<int>(type: "INTEGER", nullable: false).Annotation("Sqlite:Autoincrement", true),
                TutorId = table.Column<int>(type: "INTEGER", nullable: false),
                SourceBookingId = table.Column<int>(type: "INTEGER", nullable: false),
                Type = table.Column<string>(type: "TEXT", nullable: false),
                Percentage = table.Column<decimal>(type: "TEXT", nullable: false),
                AppliedAmount = table.Column<decimal>(type: "TEXT", nullable: false),
                AppliedBookingId = table.Column<int>(type: "INTEGER", nullable: true),
                Status = table.Column<string>(type: "TEXT", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                AppliedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
            },
            constraints: table => table.PrimaryKey("PK_TutorPenalties", x => x.Id));

        migrationBuilder.CreateTable(
            name: "TutorPayouts",
            columns: table => new
            {
                Id = table.Column<int>(type: "INTEGER", nullable: false).Annotation("Sqlite:Autoincrement", true),
                TutorId = table.Column<int>(type: "INTEGER", nullable: false),
                BookingId = table.Column<int>(type: "INTEGER", nullable: false),
                GrossAmount = table.Column<decimal>(type: "TEXT", nullable: false),
                PlatformFeeAmount = table.Column<decimal>(type: "TEXT", nullable: false),
                CompensationAmount = table.Column<decimal>(type: "TEXT", nullable: false),
                FineAmount = table.Column<decimal>(type: "TEXT", nullable: false),
                NetAmount = table.Column<decimal>(type: "TEXT", nullable: false),
                Status = table.Column<string>(type: "TEXT", nullable: false),
                CreatedAt = table.Column<DateTime>(type: "TEXT", nullable: false),
                ReleasedAt = table.Column<DateTime>(type: "TEXT", nullable: true)
            },
            constraints: table => table.PrimaryKey("PK_TutorPayouts", x => x.Id));

        migrationBuilder.CreateIndex(name: "IX_DiscountVouchers_Code", table: "DiscountVouchers", column: "Code", unique: true);
        migrationBuilder.CreateIndex(name: "IX_PaymentTransactions_ExternalPaymentId", table: "PaymentTransactions", column: "ExternalPaymentId", unique: true);
        migrationBuilder.CreateIndex(name: "IX_PaymentWebhookEvents_ExternalEventId", table: "PaymentWebhookEvents", column: "ExternalEventId", unique: true);
    }

    protected override void Down(MigrationBuilder migrationBuilder)
    {
        migrationBuilder.DropTable(name: "CancellationRecords");
        migrationBuilder.DropTable(name: "DiscountVouchers");
        migrationBuilder.DropTable(name: "PaymentTransactions");
        migrationBuilder.DropTable(name: "PaymentWebhookEvents");
        migrationBuilder.DropTable(name: "RefundTransactions");
        migrationBuilder.DropTable(name: "TutorPenalties");
        migrationBuilder.DropTable(name: "TutorPayouts");
        migrationBuilder.DropColumn(name: "CancelledAt", table: "Bookings");
        migrationBuilder.DropColumn(name: "CancelledByRole", table: "Bookings");
        migrationBuilder.DropColumn(name: "DurationHours", table: "Bookings");
        migrationBuilder.DropColumn(name: "HourlyRate", table: "Bookings");
        migrationBuilder.DropColumn(name: "PaymentStatus", table: "Bookings");
        migrationBuilder.DropColumn(name: "PaymentTransactionId", table: "Bookings");
        migrationBuilder.DropColumn(name: "SessionAmount", table: "Bookings");
    }
}
