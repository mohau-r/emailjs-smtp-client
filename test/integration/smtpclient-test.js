'use strict';

if (typeof define !== 'function') {
    var define = require('amdefine')(module);
}

define(function(require) {

    var SmtpClient = require('../../src/smtpclient'),
        simplesmtp = require('simplesmtp'),
        chai = require('chai'),
        expect = chai.expect;

    describe('smtpclient node integration tests', function() {
        var smtp, port = 10001,
            server;

        before(function(done) {
            // start smtp test server
            var options = {
                debug: false,
                disableDNSValidation: true,
                port: port,
                enableAuthentication: true,
                secureConnection: false
            };

            server = simplesmtp.createServer(options);
            server.on('startData', function( /*connection*/ ) {});
            server.on('data', function( /*connection, chunk*/ ) {});
            server.on('dataReady', function(connection, callback) {
                callback(null, 'foo');
            });
            server.on('authorizeUser', function(connection, username, password, callback) {
                callback(null, username === 'abc' && password === 'def');
            });
            server.listen(options.port, done);
        });

        after(function(done) {
            // close smtp test server
            server.end(done);
        });

        beforeEach(function(done) {
            smtp = new SmtpClient('127.0.0.1', port, {
                useSSL: false
            });
            expect(smtp).to.exist;

            smtp.connect();
            smtp.onidle = function() {
                done();
            };
        });

        it('should fail with invalid MAIL FROM', function(done) {
            smtp.onerror = function(err) {
                expect(err.message).to.equal('Bad sender address syntax');
                smtp.onclose = done;
            };

            smtp.useEnvelope({
                from: 'invalid',
                to: ['receiver@localhost']
            });
        });

        it('should fail with empty recipients', function(done) {
            smtp.onerror = function(err) {
                expect(err.message).to.equal('Can\'t send mail - no recipients defined');
                smtp.onclose = done;
            };

            smtp.useEnvelope({
                from: 'sender@example.com',
                to: []
            });
        });

        it('should fail with invalid recipients', function(done) {
            smtp.onerror = function(err) {
                expect(err.message).to.equal('Can\'t send mail - all recipients were rejected');
                smtp.onclose = done;
            };

            smtp.useEnvelope({
                from: 'sender@example.com',
                to: ['invalid']
            });
        });

        it('should pass RCPT TO', function(done) {
            smtp.onready = function(failed) {
                expect(failed).to.deep.equal([]);
                smtp.onclose = done;
                smtp.close();
            };

            smtp.useEnvelope({
                from: 'sender@example.com',
                to: ['receiver@example.com']
            });
        });

        it('should pass RCPT TO with some failures', function(done) {
            smtp.onready = function(failed) {
                expect(failed).to.deep.equal(['invalid']);
                smtp.onclose = done;
                smtp.close();
            };

            smtp.useEnvelope({
                from: 'sender@example.com',
                to: ['invalid', 'receiver@example.com']
            });
        });

        it('should succeed with DATA', function(done) {
            smtp.onidle = function() {
                smtp.onclose = done;
                smtp.quit();
            };

            smtp.onready = function(failedRecipients) {
                expect(failedRecipients).to.be.empty;

                smtp.send('Subject: test\r\n\r\nMessage body');
                smtp.end();
            };

            smtp.ondone = function(success) {
                expect(success).to.be.true;
            };

            smtp.useEnvelope({
                from: 'sender@localhost',
                to: ['receiver@localhost']
            });
        });

        it('should not idle', function(done) {
            smtp.onidle = function() {
                // should not run
                expect(true).to.be.false;
            };

            smtp.onready = function(failedRecipients) {
                expect(failedRecipients).to.be.empty;

                smtp.send('Subject: test\r\n\r\nMessage body');
                smtp.end();
            };

            smtp.ondone = function(success) {
                expect(success).to.be.true;
                smtp.onclose = done;
                smtp.quit();
            };

            smtp.useEnvelope({
                from: 'sender@localhost',
                to: ['receiver@localhost']
            });
        });
    });

    describe('smtpclient authentication tests', function() {
        var port = 10001,
            server;

        before(function(done) {
            // start smtp test server
            var options = {
                debug: false,
                disableDNSValidation: true,
                port: port,
                enableAuthentication: true,
                secureConnection: false,
                ignoreTLS: true
            };

            server = simplesmtp.createServer(options);
            server.on('startData', function( /*connection*/ ) {});
            server.on('data', function( /*connection, chunk*/ ) {});
            server.on('dataReady', function(connection, callback) {
                callback(null, 'foo');
            });
            server.on('authorizeUser', function(connection, username, password, callback) {
                callback(null, username === 'abc' && password === 'def');
            });
            server.listen(options.port, done);
        });

        after(function(done) {
            // close smtp test server
            server.end(done);
        });

        it('should authenticate with default method', function(done) {
            var smtp = new SmtpClient('127.0.0.1', port, {
                useSSL: false,
                auth: {
                    user: 'abc',
                    pass: 'def'
                }
            });
            expect(smtp).to.exist;

            smtp.connect();
            smtp.onidle = function() {
                smtp.onclose = done;
                smtp.quit();
            };
        });

        it('should authenticate with AUTH LOGIN', function(done) {
            var smtp = new SmtpClient('127.0.0.1', port, {
                useSSL: false,
                auth: {
                    user: 'abc',
                    pass: 'def'
                },
                authMethod: 'LOGIN'
            });
            expect(smtp).to.exist;

            smtp.connect();
            smtp.onidle = function() {
                smtp.onclose = done;
                smtp.quit();
            };
        });

        it('should fail with invalid credentials', function(done) {
            var smtp = new SmtpClient('127.0.0.1', port, {
                useSSL: false,
                auth: {
                    user: 'abcd',
                    pass: 'defe'
                },
                authMethod: 'LOGIN'
            });
            expect(smtp).to.exist;

            smtp.connect();
            smtp.onerror = function() {
                smtp.onclose = done;
            };
        });
    });
});